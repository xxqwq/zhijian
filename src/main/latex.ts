import { execFile, spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { cp, mkdir, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'
import { gunzipSync } from 'zlib'
import { isTexAuxFile, isTexSource } from '@shared/types'

const execFileAsync = promisify(execFile)

export type TexCompileResult =
  | { ok: true; pdfPath: string; log: string }
  | { ok: false; error: string; log: string; pdfPath?: string }

export type TexImportResult =
  | { ok: true; texPath: string }
  | { ok: false; error: string }

export type TexPathInfo = {
  path: string
  latexmk: string | null
  detected: string | null
}

export type SynctexViewResult =
  | { ok: true; page: number; x: number; y: number }
  | { ok: false; error: string }

export type SynctexEditResult =
  | { ok: true; texPath: string; line: number; column: number }
  | { ok: false; error: string }

let settingsFile = ''

export function initLatexSettings(userData: string): void {
  settingsFile = path.join(userData, 'tex-path.json')
}

export function texEngine(source: string): 'pdflatex' | 'xelatex' | 'lualatex' {
  if (/lualatex|luatex/i.test(source)) return 'lualatex'
  if (/xeCJK|ctex|xelatex|fontspec/i.test(source)) return 'xelatex'
  if (hasCjk(source)) return 'xelatex'
  return 'pdflatex'
}

function hasCjk(source: string): boolean {
  return /[\u3000-\u303F\u3400-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(source)
}

function needsCjkFont(source: string): boolean {
  if (!hasCjk(source)) return false
  if (/xeCJK|\\setCJKmainfont|\\usepackage\{ctex\}|\\documentclass\{ctex/i.test(source)) return false
  return true
}

function writeCjkLatexmkRc(): string {
  const file = path.join(tmpdir(), 'zhijian-cjk.rc')
  writeFileSync(
    file,
    [
      '&alt_tex_cmds;',
      "$pre_tex_code = '\\\\AddToHook{class/after}{\\\\usepackage{xeCJK}\\\\setCJKmainfont{Microsoft YaHei}}';",
      ''
    ].join('\n'),
    'utf-8'
  )
  return file
}

export async function compileTex(texPath: string): Promise<TexCompileResult> {
  if (!isTexSource(texPath)) {
    return { ok: false, error: '只能编译 .tex 文件', log: '' }
  }
  if (!existsSync(texPath)) {
    return { ok: false, error: '找不到这个文件', log: '' }
  }
  const latexmk = await findLatexmk()
  if (!latexmk) {
    const configured = getUserTexBin()
    return {
      ok: false,
      error: configured
        ? `指定的 TeX 路径里没有 latexmk：${configured}`
        : '没有找到 latexmk。请到「文件 → TeX 路径…」填写本机 TeX 的 bin 目录。',
      log: ''
    }
  }
  const source = await readFile(texPath, 'utf-8')
  const engine = texEngine(source)
  const flags = ['-view=none', '-interaction=nonstopmode', '-file-line-error', '-synctex=1', '-shell-escape']
  const args =
    engine === 'xelatex'
      ? [...flags, '-xelatex', path.basename(texPath)]
      : engine === 'lualatex'
        ? [...flags, '-lualatex', path.basename(texPath)]
        : [...flags, '-pdf', path.basename(texPath)]
  if (engine === 'xelatex' && needsCjkFont(source)) {
    args.splice(-1, 0, '-r', writeCjkLatexmkRc(), '-g')
  }

  const binDir = path.dirname(latexmk)
  const pdfPath = texPath.replace(/\.tex$/i, '.pdf')
  const before = existsSync(pdfPath) ? statSync(pdfPath).mtimeMs : 0
  const result = await runCommand(latexmk, args, path.dirname(texPath), 180_000, binDir)
  const hasPdf = existsSync(pdfPath)
  const fresh = hasPdf && statSync(pdfPath).mtimeMs > before
  if (result.code === 0 && hasPdf) {
    if (hasCjk(source) && /Missing character: There is no .* \(U\+[0-9A-F]+\)/i.test(result.log)) {
      return {
        ok: false,
        error: 'PDF 已生成，但中文没有对应字体。请完全退出纸间后再编译一次。',
        log: result.log,
        pdfPath
      }
    }
    return { ok: true, pdfPath, log: result.log }
  }
  return {
    ok: false,
    error: firstTexError(result.log) || (result.code === 0 ? '编译结束，但没有生成 PDF' : '编译失败'),
    log: result.log,
    pdfPath: fresh ? pdfPath : undefined
  }
}

export async function importTexTemplate(
  workspace: string,
  source: string
): Promise<TexImportResult> {
  if (!existsSync(workspace) || !existsSync(source)) {
    return { ok: false, error: '找不到模板或工作区' }
  }
  const base = sanitizeDirName(path.basename(source, path.extname(source))) || 'latex-paper'
  let dest = path.join(workspace, base)
  let n = 2
  while (existsSync(dest)) {
    dest = path.join(workspace, `${base}-${n}`)
    n += 1
  }
  await mkdir(dest, { recursive: true })
  try {
    if (statSync(source).isDirectory()) {
      await cp(source, dest, { recursive: true, filter: skipJunk })
    } else if (source.toLowerCase().endsWith('.zip')) {
      const extracted = await extractZip(source, dest)
      if (!extracted.ok) return extracted
    } else {
      return { ok: false, error: '请选择模板文件夹或 .zip' }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '无法导入模板' }
  }
  const texPath = findMainTex(dest)
  if (!texPath) return { ok: false, error: '模板里没有找到 .tex 主文件' }
  return { ok: true, texPath }
}

export async function getTexPathInfo(): Promise<TexPathInfo> {
  const configured = getUserTexBin()
  const detected = await detectLatexmk()
  const latexmk = configured ? latexmkFromInput(configured) : detected
  return { path: configured, latexmk, detected }
}

export function setUserTexBin(input: string): { ok: true; info: TexPathInfo } | { ok: false; error: string } {
  const next = input.trim()
  if (!next) {
    saveUserTexBin('')
    return {
      ok: true,
      info: {
        path: '',
        latexmk: findLatexmkOnDisk(),
        detected: findLatexmkOnDisk()
      }
    }
  }
  const latexmk = latexmkFromInput(next)
  if (!latexmk) {
    return {
      ok: false,
      error: '这个路径里找不到 latexmk。请选 bin 目录，例如 E:\\texlive\\2026\\bin\\windows'
    }
  }
  saveUserTexBin(path.dirname(latexmk))
  return {
    ok: true,
    info: {
      path: path.dirname(latexmk),
      latexmk,
      detected: findLatexmkOnDisk()
    }
  }
}

async function findLatexmk(): Promise<string | null> {
  const configured = getUserTexBin()
  if (configured) return latexmkFromInput(configured)
  return detectLatexmk()
}

async function detectLatexmk(): Promise<string | null> {
  const fromDisk = findLatexmkOnDisk()
  if (fromDisk) return fromDisk
  return pickPreferredLatexmk(await findAllOnPath())
}

function getUserTexBin(): string {
  if (!settingsFile || !existsSync(settingsFile)) return ''
  try {
    const raw = JSON.parse(readFileSync(settingsFile, 'utf-8')) as { path?: unknown }
    return typeof raw.path === 'string' ? raw.path.trim() : ''
  } catch {
    return ''
  }
}

function saveUserTexBin(binPath: string): void {
  if (!settingsFile) return
  mkdirSync(path.dirname(settingsFile), { recursive: true })
  writeFileSync(settingsFile, `${JSON.stringify({ path: binPath }, null, 2)}\n`, 'utf-8')
}

export function latexmkFromInput(input: string): string | null {
  const target = input.trim().replace(/^["']|["']$/g, '')
  if (!target || !existsSync(target)) return null
  let stat
  try {
    stat = statSync(target)
  } catch {
    return null
  }
  const exe = process.platform === 'win32' ? 'latexmk.exe' : 'latexmk'
  if (stat.isFile()) {
    const base = path.basename(target).toLowerCase()
    if (base === 'latexmk.exe' || base === 'latexmk') return target
    const sibling = path.join(path.dirname(target), exe)
    return existsSync(sibling) ? sibling : null
  }
  if (!stat.isDirectory()) return null
  const direct = path.join(target, exe)
  if (existsSync(direct)) return direct
  const nested = [
    path.join(target, 'bin', 'windows', exe),
    path.join(target, 'windows', exe),
    path.join(target, 'bin', 'x86_64-linux', 'latexmk'),
    path.join(target, 'bin', 'universal-darwin', 'latexmk')
  ]
  for (const file of nested) {
    if (existsSync(file)) return file
  }
  try {
    for (const year of readdirSync(target).sort().reverse()) {
      const win = path.join(target, year, 'bin', 'windows', exe)
      const unix = path.join(target, year, 'bin', 'x86_64-linux', 'latexmk')
      if (existsSync(win)) return win
      if (existsSync(unix)) return unix
    }
  } catch {
    /* skip */
  }
  return null
}

function findLatexmkOnDisk(): string | null {
  const files = [
    ...texliveLatexmkCandidates(),
    'E:\\MikTex\\miktex\\bin\\x64\\latexmk.exe',
    'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\latexmk.exe'
  ]
  return files.find((file) => existsSync(file)) ?? null
}

function texliveLatexmkCandidates(): string[] {
  const roots = ['E:\\texlive', 'F:\\texlive', 'C:\\texlive', 'D:\\texlive']
  const found: string[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    let years: string[] = []
    try {
      years = readdirSync(root)
    } catch {
      continue
    }
    for (const year of years.sort().reverse()) {
      const win = path.join(root, year, 'bin', 'windows', 'latexmk.exe')
      const unix = path.join(root, year, 'bin', 'x86_64-linux', 'latexmk')
      if (existsSync(win)) found.push(win)
      if (existsSync(unix)) found.push(unix)
    }
  }
  return found
}

function pickPreferredLatexmk(paths: string[]): string | null {
  if (paths.length === 0) return null
  return paths.find((item) => /texlive/i.test(item)) ?? paths[0]
}

async function findAllOnPath(): Promise<string[]> {
  const names = process.platform === 'win32' ? ['latexmk.exe', 'latexmk'] : ['latexmk']
  const found: string[] = []
  for (const name of names) {
    try {
      const cmd = process.platform === 'win32' ? 'where.exe' : 'which'
      const { stdout } = await execFileAsync(cmd, [name])
      for (const line of stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
        if (!found.includes(line)) found.push(line)
      }
    } catch {
      /* skip */
    }
  }
  return found
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  binDir?: string
): Promise<{ code: number; log: string }> {
  return new Promise((resolve) => {
    const env = { ...process.env }
    if (binDir) {
      env.PATH = `${binDir}${path.delimiter}${env.PATH ?? ''}`
      env.Path = env.PATH
    }
    const child = spawn(command, args, { cwd, env, windowsHide: true })
    let log = ''
    const onData = (chunk: Buffer): void => {
      log += chunk.toString()
      if (log.length > 80_000) log = log.slice(-60_000)
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    const timer = setTimeout(() => {
      child.kill()
      resolve({ code: 1, log: `${log}\n编译超时。` })
    }, timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: 1, log: error.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, log })
    })
  })
}

export async function synctexView(
  texPath: string,
  line: number,
  column: number,
  pdfPath: string
): Promise<SynctexViewResult> {
  const fromFile = viewFromSynctexFile(pdfPath, texPath, line)
  if (fromFile) return { ok: true, ...fromFile }
  const fromCli = await viewFromSynctexCli(texPath, line, column, pdfPath)
  if (fromCli) return { ok: true, ...fromCli }
  return { ok: false, error: '没有 SyncTeX 记录。请先成功编译一次。' }
}

export async function synctexEdit(
  pdfPath: string,
  page: number,
  x: number,
  y: number
): Promise<SynctexEditResult> {
  const synctex = await findSynctex()
  if (!synctex) {
    return { ok: false, error: '找不到 synctex。请确认 TeX 的 bin 目录可用。' }
  }
  if (!existsSync(pdfPath)) {
    return { ok: false, error: '找不到这份 PDF' }
  }
  const cwd = path.dirname(pdfPath)
  const result = await runCommand(
    synctex,
    ['edit', '-o', `${page}:${x.toFixed(2)}:${y.toFixed(2)}:${path.basename(pdfPath)}`],
    cwd,
    15_000,
    path.dirname(synctex)
  )
  const parsed = parseSynctexEditOut(result.log)
  if (!parsed) {
    return { ok: false, error: '这一页没有对应的源码位置' }
  }
  return {
    ok: true,
    texPath: resolveSynctexInput(parsed.input, cwd),
    line: parsed.line,
    column: parsed.column
  }
}

function viewFromSynctexFile(
  pdfPath: string,
  texPath: string,
  line: number
): { page: number; x: number; y: number } | null {
  const text = readSynctexText(pdfPath)
  if (!text) return null
  const page = pageForLine(text, texPath, line)
  if (!page) return null
  return { page, x: 0, y: 0 }
}

async function viewFromSynctexCli(
  texPath: string,
  line: number,
  column: number,
  pdfPath: string
): Promise<{ page: number; x: number; y: number } | null> {
  const synctex = await findSynctex()
  if (!synctex || !existsSync(pdfPath)) return null
  const cwd = path.dirname(pdfPath)
  const result = await runCommand(
    synctex,
    ['view', '-i', `${line}:${Math.max(0, column)}:${path.basename(texPath)}`, '-o', path.basename(pdfPath)],
    cwd,
    15_000,
    path.dirname(synctex)
  )
  return parseSynctexViewOut(result.log)
}

async function findSynctex(): Promise<string | null> {
  const latexmk = await findLatexmk()
  if (!latexmk) return null
  const exe = process.platform === 'win32' ? 'synctex.exe' : 'synctex'
  const beside = path.join(path.dirname(latexmk), exe)
  return existsSync(beside) ? beside : null
}

function synctexPathForPdf(pdfPath: string): string | null {
  const gz = pdfPath.replace(/\.pdf$/i, '.synctex.gz')
  if (existsSync(gz)) return gz
  const raw = pdfPath.replace(/\.pdf$/i, '.synctex')
  return existsSync(raw) ? raw : null
}

function readSynctexText(pdfPath: string): string | null {
  const file = synctexPathForPdf(pdfPath)
  if (!file) return null
  try {
    const buf = readFileSync(file)
    if (file.toLowerCase().endsWith('.gz')) return gunzipSync(buf).toString('utf8')
    return buf.toString('utf8')
  } catch {
    return null
  }
}

function pageForLine(synctex: string, texPath: string, line: number): number | null {
  const tags = new Set<string>()
  const inputRe = /^Input:(\d+):(.+)$/gm
  let input: RegExpExecArray | null
  while ((input = inputRe.exec(synctex))) {
    if (synctexInputMatches(input[2].trim(), texPath)) tags.add(input[1])
  }
  if (tags.size === 0) return null
  let page = 0
  let bestPage = 0
  let bestDist = Infinity
  for (const row of synctex.split(/\r?\n/)) {
    if (row.startsWith('{')) {
      const next = Number(row.slice(1))
      if (next > 0) page = next
      continue
    }
    const rec = /^[(\[xhgk$v](\d+),(\d+)/.exec(row)
    if (!rec || !tags.has(rec[1])) continue
    const dist = Math.abs(Number(rec[2]) - line)
    if (dist < bestDist) {
      bestDist = dist
      bestPage = page
    }
  }
  return bestPage > 0 ? bestPage : null
}

function synctexInputMatches(recorded: string, texPath: string): boolean {
  const a = recorded.replace(/\\/g, '/').replace(/^"|"$/g, '').toLowerCase()
  const b = texPath.replace(/\\/g, '/').toLowerCase()
  const base = path.basename(texPath).toLowerCase()
  return a === b || a.endsWith(`/${base}`) || a === base
}

function parseSynctexViewOut(out: string): { page: number; x: number; y: number } | null {
  const page = /(?:^|\n)Page:\s*(\d+)/i.exec(out)
  if (!page) return null
  return {
    page: Number(page[1]),
    x: Number(/(?:^|\n)x:\s*([\d.]+)/i.exec(out)?.[1] ?? 0),
    y: Number(/(?:^|\n)y:\s*([\d.]+)/i.exec(out)?.[1] ?? 0)
  }
}

function parseSynctexEditOut(out: string): { input: string; line: number; column: number } | null {
  const input = /(?:^|\n)Input:(.+)/i.exec(out)
  const line = /(?:^|\n)Line:\s*(\d+)/i.exec(out)
  if (!input || !line) return null
  return {
    input: input[1].trim(),
    line: Number(line[1]),
    column: Number(/(?:^|\n)Column:\s*(\d+)/i.exec(out)?.[1] ?? 0)
  }
}

function resolveSynctexInput(input: string, cwd: string): string {
  const cleaned = input.replace(/^"|"$/g, '').trim()
  if (path.isAbsolute(cleaned)) return path.normalize(cleaned)
  return path.normalize(path.join(cwd, cleaned))
}

function firstTexError(log: string): string | null {
  const lines = log.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (const line of lines) {
    const fileLine = line.match(/([^\\/]+\.tex):(\d+):\s*(?:LaTeX Error:\s*)?(.+)$/i)
    if (fileLine) {
      const detail = fileLine[3].replace(/\s+/g, ' ')
      if (/Unicode character/i.test(detail)) {
        return `第 ${fileLine[2]} 行有中文或全角符号。Springer / IEEE 模板默认是 pdfLaTeX，编不了中文。请在 \\documentclass 后面加上：\\usepackage{xeCJK} 和 \\setCJKmainfont{Microsoft YaHei}`
      }
      return `第 ${fileLine[2]} 行：${detail}`
    }
    if (/^! /.test(line)) {
      const detail = line.replace(/^! /, '')
      if (/Unicode character|inputenc/i.test(detail)) {
        return '文稿含中文或全角符号，pdfLaTeX 无法编译。请加上 xeCJK 中文字体后再编。'
      }
      return detail
    }
    if (/Fatal error occurred/i.test(line)) return line
    if (/Emergency stop/i.test(line)) return '编译中断（Emergency stop）'
    if (/I can't write on file/i.test(line)) return line
    if (/File `.*' not found/i.test(line)) return line
  }
  if (/ENOENT/i.test(log)) return '无法启动 latexmk，请到「文件 → TeX 路径…」填写本机 TeX 的 bin 目录'
  return null
}

async function extractZip(zipPath: string, dest: string): Promise<TexImportResult> {
  const tar = process.platform === 'win32' ? 'tar.exe' : 'tar'
  const unpacked = await runCommand(tar, ['-xf', zipPath, '-C', dest], dest, 60_000)
  if (unpacked.code === 0) return { ok: true, texPath: dest }
  if (process.platform === 'win32') {
    const ps = await runCommand(
      'powershell.exe',
      ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`],
      dest,
      60_000
    )
    if (ps.code === 0) return { ok: true, texPath: dest }
    return { ok: false, error: ps.log || unpacked.log || '无法解压 zip' }
  }
  return { ok: false, error: unpacked.log || '无法解压 zip' }
}

function findMainTex(root: string): string | null {
  const files = listTexFiles(root)
  if (files.length === 0) return null
  const preferred = ['main.tex', 'paper.tex', 'manuscript.tex', 'sample.tex', 'template.tex']
  for (const name of preferred) {
    const hit = files.find((file) => path.basename(file).toLowerCase() === name)
    if (hit) return hit
  }
  for (const file of files) {
    try {
      const text = readFileSync(file, 'utf-8')
      if (/\\documentclass\b/.test(text)) return file
    } catch {
      /* skip */
    }
  }
  return files[0]
}

function listTexFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const full = path.join(dir, name)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) out.push(...listTexFiles(full))
    else if (isTexSource(name) && !isTexAuxFile(name)) out.push(full)
  }
  return out
}

function skipJunk(src: string): boolean {
  const name = path.basename(src)
  if (name === '.git' || name === 'node_modules') return false
  return true
}

function sanitizeDirName(name: string): string {
  return name.replace(/[<>:"|?*]/g, '').trim() || 'latex-paper'
}
