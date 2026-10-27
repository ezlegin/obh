import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

export function Table({
  head,
  children,
  className,
}: {
  head: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("doc-table", className)}>
      <table>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

type PropRow = {
  name: ReactNode
  type?: ReactNode
  required?: boolean
  defaultValue?: ReactNode
  description: ReactNode
}

export function PropsTable({
  rows,
  showType = true,
}: {
  rows: PropRow[]
  showType?: boolean
}) {
  return (
    <Table
      head={
        <>
          <th>Property</th>
          {showType ? <th>Type</th> : null}
          <th>Description</th>
        </>
      }
    >
      {rows.map((row, index) => (
        <tr key={index}>
          <td>
            <span className="font-mono text-[0.78rem] text-foreground">
              {row.name}
            </span>
            {row.required ? (
              <span className="ml-2 text-[0.65rem] text-danger">required</span>
            ) : (
              <span className="ml-2 text-[0.65rem] text-white/30">
                optional
              </span>
            )}
            {row.defaultValue !== undefined ? (
              <div className="mt-1 text-[0.68rem] text-white/35">
                default:{" "}
                <code className="font-mono text-white/55">
                  {row.defaultValue}
                </code>
              </div>
            ) : null}
          </td>
          {showType ? (
            <td>
              <code>{row.type}</code>
            </td>
          ) : null}
          <td className="text-[0.8rem] leading-relaxed text-[#a9a9a2]">
            {row.description}
          </td>
        </tr>
      ))}
    </Table>
  )
}
