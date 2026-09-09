import { joinPath, splitTexLog } from '@renderer/lib/texLog'
import { useAppStore } from '@renderer/store/appStore'

interface Props {
  log: string
  root: string
}

export function TexLog({ log, root }: Props) {
  const openFilePath = useAppStore((s) => s.openFilePath)

  return (
    <pre className="tex-log">
      {splitTexLog(log).map((part, index) =>
        part.file && part.line ? (
          <button
            key={`${part.file}:${part.line}:${index}`}
            type="button"
            className="tex-log-link"
            title={`打开 ${part.file} 第 ${part.line} 行`}
            onClick={() => void openFilePath(joinPath(root, part.file as string), { line: part.line })}
          >
            {part.text}
          </button>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </pre>
  )
}
