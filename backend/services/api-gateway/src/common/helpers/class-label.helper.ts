type LabelPart = string | number | null | undefined;

/** Returns one readable class label without duplicating a stored stream suffix. */
export function formatClassLabel(nameValue: LabelPart, streamValue: LabelPart): string {
  const name = nameValue === null || nameValue === undefined ? '' : String(nameValue).trim().replace(/\s+/g, ' ');
  const stream = streamValue === null || streamValue === undefined ? '' : String(streamValue).trim().replace(/\s+/g, ' ');
  if (!name) return stream;
  if (!stream) return name;

  const lowerName = name.toLocaleLowerCase();
  const lowerStream = stream.toLocaleLowerCase();
  const alreadyIncluded = lowerName === lowerStream
    || lowerName.endsWith(` ${lowerStream}`)
    || lowerName.endsWith(`-${lowerStream}`)
    || lowerName.endsWith(`\u2013${lowerStream}`)
    || lowerName.endsWith(`\u2014${lowerStream}`)
    || lowerName.endsWith(`\u00b7 ${lowerStream}`)
    || (/^[a-z]$/i.test(stream) && new RegExp(`\\d${stream}$`, 'i').test(name));

  return alreadyIncluded ? name : `${name} ${stream}`;
}
