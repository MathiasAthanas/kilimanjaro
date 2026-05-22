enum SearchResultType { student, announcement, shortcut, recent }

class SearchResultModel {
  const SearchResultModel({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.route,
    this.avatarName,
    this.metaLabel,
  });

  final String id;
  final SearchResultType type;
  final String title;
  final String subtitle;
  final String route;
  final String? avatarName;
  final String? metaLabel;
}
