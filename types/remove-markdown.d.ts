// Type definitions for remove-markdown v0.1.x
// Project: https://github.com/stiang/remove-markdown
// Definitions by: Muhammad Ragib Hasin <https://github.com/RagibHasin>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare module 'remove-markdown' {
  interface RemoveMarkdown {
    /**
     * Strip Markdown formatting from text
     * @param markdown Markdown text
     * @param options
     */
    (markdown: string, options?: {
      stripListLeaders?: boolean
      gfm?: boolean
    }): string
  }

  var rmMD: RemoveMarkdown

  export = rmMD
}
