function clean(value: unknown): string {
  return value === null || value === undefined
    ? ''
    : String(value).trim().replace(/\s+/g, ' ');
}

function nameAlreadyContainsStream(name: string, stream: string): boolean {
  const lowerName = name.toLocaleLowerCase();
  const lowerStream = stream.toLocaleLowerCase();
  if (lowerName === lowerStream) return true;

  if (
    lowerName.endsWith(` ${lowerStream}`)
    || lowerName.endsWith(`-${lowerStream}`)
    || lowerName.endsWith(`\u2013${lowerStream}`)
    || lowerName.endsWith(`\u2014${lowerStream}`)
    || lowerName.endsWith(`\u00b7 ${lowerStream}`)
  ) {
    return true;
  }

  // Some older records use compact labels such as "Class 1A".
  return /^[a-z]$/i.test(stream) && new RegExp(`\\d${stream}$`, 'i').test(name);
}

/** Builds a class label without repeating a stream already present in its name. */
export function formatClassLabel(
  nameValue: unknown,
  streamValue: unknown,
  separator = ' ',
): string {
  const name = clean(nameValue);
  const stream = clean(streamValue);

  if (!name) return stream;
  if (!stream || nameAlreadyContainsStream(name, stream)) return name;
  return `${name}${separator}${stream}`;
}
