import Handlebars from 'handlebars';

export function compileTemplateSafe(template: string, variables: Record<string, unknown>): string {
  const compiled = Handlebars.compile(template);
  return compiled(variables);
}
