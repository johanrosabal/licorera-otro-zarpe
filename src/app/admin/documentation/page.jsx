
import { promises as fs } from 'fs';
import path from 'path';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AuthorizedOnly } from '@/components/auth/authorized-only';

async function getReadmeContent() {
  const readmePath = path.join(process.cwd(), 'README.md');
  try {
    const fileContent = await fs.readFile(readmePath, 'utf8');
    // Configure marked to handle tables and other GFM features
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
    const dirtyHtml = await marked.parse(fileContent);
    const cleanHtml = DOMPurify.sanitize(dirtyHtml);
    return cleanHtml;
  } catch (error) {
    console.error('Error reading README.md:', error);
    return '<p>Error: No se pudo cargar la documentación.</p>';
  }
}

export default async function DocumentationPage() {
  const contentHtml = await getReadmeContent();

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <Card>
        <CardHeader>
          <CardTitle>Documentación del Proyecto</CardTitle>
          <CardDescription>
            Contenido del archivo <code>README.md</code> renderizado como HTML.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm md:prose-base lg:prose-lg prose-invert max-w-none prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-a:text-accent prose-strong:text-primary prose-code:bg-muted prose-code:p-1 prose-code:rounded-md prose-blockquote:border-l-primary prose-table:border prose-th:p-2 prose-th:bg-muted prose-td:p-2"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </CardContent>
      </Card>
    </AuthorizedOnly>
  );
}
