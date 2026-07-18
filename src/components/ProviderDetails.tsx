export function ProviderDetails({ details }: { details: string }) {
  if (!details.trim()) {
    return null
  }

  return (
    <details className="provider-details">
      <summary>Show provider details</summary>
      <pre>{details}</pre>
    </details>
  )
}
