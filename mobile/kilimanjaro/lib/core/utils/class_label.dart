String formatClassLabel(Object? nameValue, Object? streamValue) {
  final name = (nameValue?.toString() ?? '').trim().replaceAll(RegExp(r'\s+'), ' ');
  final stream = (streamValue?.toString() ?? '').trim().replaceAll(RegExp(r'\s+'), ' ');
  if (name.isEmpty) return stream;
  if (stream.isEmpty) return name;

  final lowerName = name.toLowerCase();
  final lowerStream = stream.toLowerCase();
  final alreadyIncluded = lowerName == lowerStream ||
      lowerName.endsWith(' $lowerStream') ||
      lowerName.endsWith('-$lowerStream') ||
      lowerName.endsWith('\u2013$lowerStream') ||
      lowerName.endsWith('\u2014$lowerStream') ||
      lowerName.endsWith('\u00b7 $lowerStream') ||
      (RegExp(r'^[a-z]$', caseSensitive: false).hasMatch(stream) &&
          RegExp('\\d${RegExp.escape(stream)}\$', caseSensitive: false).hasMatch(name));

  return alreadyIncluded ? name : '$name $stream';
}
