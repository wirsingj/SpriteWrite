import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createFullSpriteSheetExportMetadata } from '../src/domain/exportPlanning'
import { renderFullSpriteSheetToRgbaBuffer } from '../src/domain/exportRaster'
import { createOozeMeleeAttackProject } from '../src/domain/oozeMeleeRecipe'
import { getProjectTemplate, SPRITE_PROJECT_TEMPLATES } from '../src/domain/projectTemplates'
import { validateProject } from '../src/domain/spriteData'
import type { SpriteProject } from '../src/domain/spriteTypes'
import { encodeRgbaBufferToPng } from '../src/utils/pngExport'

const DEFAULT_API_PORT = 5174
const DEFAULT_HOST = '127.0.0.1'
const MAX_JSON_BODY_BYTES = 1024 * 1024

interface AssetRequestBody {
  name?: string
  outputDir?: string
  scale?: number
  margin?: number
  spacing?: number
}

interface TemplateRequestBody extends AssetRequestBody {
  templateId?: string
  width?: number
  height?: number
  assetType?: SpriteProject['assetType']
}

interface HttpError {
  statusCode: number
  errorCode: string
  message: string
  name: 'HttpError'
}

function createHttpError(statusCode: number, errorCode: string, message: string): HttpError {
  const error = new Error(message) as Error & HttpError
  error.name = 'HttpError'
  error.statusCode = statusCode
  error.errorCode = errorCode
  return error
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error: unknown) => {
    if (isHttpError(error)) {
      sendJson(response, error.statusCode, {
        error: error.errorCode,
        message: error.message,
      })
      return
    }

    sendJson(response, 500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error),
    })
  })
})

const port = parsePort(process.env.SPRITEWRITE_API_PORT, DEFAULT_API_PORT)
const host = process.env.SPRITEWRITE_API_HOST ?? DEFAULT_HOST

server.listen(port, host, () => {
  console.log(`SpriteWrite API listening at http://${host}:${port}`)
})

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`)

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'spritewrite-api',
      version: 1,
      endpoints: ['GET /health', 'GET /templates', 'POST /projects/from-template', 'POST /recipes/ooze-melee-attack'],
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/templates') {
    sendJson(response, 200, {
      templates: SPRITE_PROJECT_TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        assetType: template.assetType,
        width: template.width,
        height: template.height,
      })),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/projects/from-template') {
    const body = await readJsonBody<TemplateRequestBody>(request)
    const template = getProjectTemplate(requireString(body.templateId, 'templateId'))
    const project = template.createProject({
      name: body.name ?? template.name,
      width: body.width,
      height: body.height,
      assetType: body.assetType,
    })
    sendJson(response, 200, await createAssetResponse(project, body))
    return
  }

  if (request.method === 'POST' && url.pathname === '/recipes/ooze-melee-attack') {
    const body = await readJsonBody<AssetRequestBody>(request)
    const project = createOozeMeleeAttackProject(body.name ?? 'Ooze Melee Attack')
    sendJson(response, 200, await createAssetResponse(project, body))
    return
  }

  sendJson(response, 404, {
    error: 'not_found',
    message: `No SpriteWrite API route for ${request.method ?? 'GET'} ${url.pathname}`,
  })
}

async function createAssetResponse(project: SpriteProject, body: AssetRequestBody) {
  const validation = validateProject(project)
  if (!validation.valid) {
    throw new Error(`Project failed validation: ${validation.errors.join('; ')}`)
  }

  const slug = slugify(project.name)
  const outputDir = resolve(body.outputDir ?? join(process.cwd(), 'spritewrite-output', slug))
  const scale = normalizePositiveInteger(body.scale, 2, 'scale')
  const margin = normalizeNonNegativeInteger(body.margin, 0, 'margin')
  const spacing = normalizeNonNegativeInteger(body.spacing, 0, 'spacing')
  const imageFilename = `${slug}.png`
  const metadataFilename = `${slug}.metadata.json`
  const projectFilename = `${slug}.spritewrite.json`
  const exportOptions = { scale, margin, spacing, imageFilename }
  const metadata = createFullSpriteSheetExportMetadata(project, exportOptions)
  const pngBytes = Buffer.from(new Uint8Array(encodeRgbaBufferToPng(renderFullSpriteSheetToRgbaBuffer(project, exportOptions))))

  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(join(outputDir, projectFilename), JSON.stringify(project, null, 2), 'utf8'),
    writeFile(join(outputDir, metadataFilename), JSON.stringify(metadata, null, 2), 'utf8'),
    writeFile(join(outputDir, imageFilename), pngBytes),
  ])

  return {
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      assetType: project.assetType,
      canvas: project.canvas,
      animations: project.animations.map((animation) => ({
        id: animation.id,
        name: animation.name,
        fps: animation.fps,
        frameCount: animation.frameIds.length,
      })),
    },
    files: {
      outputDir,
      projectJson: join(outputDir, projectFilename),
      metadataJson: join(outputDir, metadataFilename),
      fullSheetPng: join(outputDir, imageFilename),
    },
    export: {
      scale,
      margin,
      spacing,
      sheetWidth: metadata.sheetWidth,
      sheetHeight: metadata.sheetHeight,
    },
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  let raw = ''

  for await (const chunk of request) {
    raw += chunk
    if (Buffer.byteLength(raw) > MAX_JSON_BODY_BYTES) {
      throw createHttpError(413, 'payload_too_large', 'JSON body is too large.')
    }
  }

  if (!raw.trim()) {
    return {} as T
  }

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    if (error instanceof Error) {
      throw createHttpError(400, 'invalid_json', `Invalid JSON body: ${error.message}`)
    }
    throw createHttpError(400, 'invalid_json', 'Invalid JSON body.')
  }
}

function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    error.name === 'HttpError' &&
    typeof (error as { statusCode?: unknown; errorCode?: unknown }).statusCode === 'number' &&
    typeof (error as { errorCode?: unknown }).errorCode === 'string'
  )
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(`${JSON.stringify(payload, null, 2)}\n`)
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw createHttpError(400, 'missing_field', `${fieldName} must be a non-empty string.`)
  }
  return value
}

function normalizePositiveInteger(value: unknown, fallback: number, fieldName: string): number {
  if (value === undefined) {
    return fallback
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 16) {
    throw createHttpError(400, 'invalid_field', `${fieldName} must be an integer from 1 to 16.`)
  }
  return value
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, fieldName: string): number {
  if (value === undefined) {
    return fallback
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 256) {
    throw createHttpError(400, 'invalid_field', `${fieldName} must be an integer from 0 to 256.`)
  }
  return value
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'spritewrite-asset'
  )
}

function parsePort(rawPort: string | undefined, fallback: number) {
  if (typeof rawPort !== 'string') {
    return fallback
  }

  const parsed = Number.parseInt(rawPort, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    return fallback
  }

  return parsed
}





