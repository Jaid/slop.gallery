import {dirname, relative, resolve} from 'node:path'

import fencen from 'fencen'
import fs from 'fs-extra'
import ts from 'typescript'

/** Read source without evaluating it. Entry-point exports define the authoring API, not a directory glob. */
export default class PromptSources {
  readonly files = new Map<string, string>

  constructor(private readonly root: string) {}

  async add(file: string): Promise<void> {
    const absolute = resolve(this.root, file)
    const key = relative(this.root, absolute).replaceAll('\\', '/')
    if (key.startsWith('../')) {
      throw new Error(`Prompt source escaped the package: ${file}`)
    }
    if (this.files.has(key)) {
      return
    }
    const source = await fs.readFile(absolute, 'utf8')
    this.files.set(key, source)
    const parsed = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true)
    // Import-type expressions deriving IDs from the catalogue are not an authoring API.
    // Follow actual import/export declarations, including type-only helper declarations.
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) {
        continue
      }
      const specifier = statement.moduleSpecifier
      if (!specifier || !ts.isStringLiteral(specifier)) {
        continue
      }
      if (specifier.text.startsWith('.') && specifier.text.endsWith('.ts')) {
        await this.add(resolve(dirname(absolute), specifier.text))
      }
    }
  }

  markdown(files: Iterable<string> = this.files.keys()) {
    return Array.from(files, file => `### ${file}\n\n${fencen.block(this.files.get(file)!.trimEnd(), {
      language: 'ts',
      trim: false,
    })}`).join('\n\n')
  }
}
