export function SkeletonRow({ cols = 3 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '0.625rem 0.75rem' }}>
          <span className="skeleton" style={{ height: 14, width: i === 0 ? '70%' : i === cols - 1 ? '40%' : '55%', display: 'block' }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard({ height = 80 }) {
  return <div className="skeleton card" style={{ height, marginBottom: '0.75rem' }} />;
}

export function SkeletonText({ width = '60%', height = 14 }) {
  return <span className="skeleton" style={{ width, height, display: 'inline-block' }} />;
}
