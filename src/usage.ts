import {readFile} from 'node:fs/promises'

const USAGE = `Usage: pele <command> [options] [files...]

Validate diagrams and render them to SVG with Pele (https://pele.run).

Commands:
  check [files...]     Validate diagrams with Pele's parser and layout engine
  render [files...]    Render diagrams to SVG files
  types                List the diagram types Pele supports

Inputs:
  .mmd .mermaid        One diagram per file
  .md .markdown        Every \`\`\`mermaid code block
  -  (or no files)     One diagram from stdin; render writes the SVG to stdout

Output options (render only):
  -o, --out-dir <dir>  Write SVGs here (default: next to each input); not with stdin
                       a.mmd -> a.svg; README.md -> README-1.svg, README-2.svg, ...
  --theme <name>       Embed a color theme: light, dark, or auto (follows the
                       viewer's color scheme). Default: Pele's unthemed output
  --css <file>         Embed CSS in each SVG, after the theme. Set --pele-*
                       variables here, see https://pele.run/theming
  --markdown-out <file>  Write a copy of the one Markdown input with each
                       rendered diagram replaced by its image, and save each
                       diagram's source as .mmd next to its SVG

Reporting (check and render):
  --format <name>      text, json, or github (annotations for GitHub Actions).
                       Default: github when GITHUB_ACTIONS=true, else text.
                       json is not available when rendering stdin to stdout

Pele render options (check and render):
  --max-width <px>             Available width; narrow widths rearrange the layout
  --no-auto-direction          Keep the source direction (needs --max-width)
  --direction-breakpoint <px>  Width below which layouts may turn vertical (640;
                               needs --max-width, not with --no-auto-direction)
  --no-responsive              Fixed pixel size instead of shrinking to fit
  --font-family <font>         Label font (sans-serif)
  --font-family-mono <font>    Monospace label font (monospace)
  --font-size <px>             Base font size (16)
  --padding <px>               Space around the diagram
  --now <date>                 Reference time for Gantt charts (now)
  --limit <chars>              Max source length (50000)
  --output-limit <chars>       Max SVG length (4000000)
  --max-edges <n>              Max flowchart and agentflow edges (5000)
  --no-links                   Drop links
  --no-images                  Drop images
  --link-schemes <list>        Allowed link schemes (http,https,mailto,tel;
                               not with --no-links)
  --image-schemes <list>       Allowed image schemes (http,https; not with --no-images)
  --link-rel <value>           rel attribute of links (noopener; not with --no-links)

  -h, --help                   Show this help
  -v, --version                Show the pele-cli and Pele versions

Exit codes: 0 all diagrams valid, 1 invalid diagrams, 2 usage or file errors.`

async function packageVersion(manifestUrl: string): Promise<string> {
	const content = await readFile(new URL(manifestUrl), 'utf8')
	const manifest: unknown = JSON.parse(content)
	if (
		typeof manifest === 'object' &&
		manifest !== null &&
		'version' in manifest &&
		typeof manifest.version === 'string'
	) {
		return manifest.version
	}
	throw new Error(`${manifestUrl} has no version`)
}

async function versions(): Promise<string> {
	const [cli, pele] = await Promise.all([
		// Resolves to the package root from both src/ and dist/.
		packageVersion(import.meta.resolve('../package.json')),
		packageVersion(import.meta.resolve('pele/package.json')),
	])
	return `pele-cli ${cli} (pele ${pele})`
}

export {USAGE, versions}
