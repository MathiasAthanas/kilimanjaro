import 'package:flutter/material.dart';

/// Rows of equal-width tiles with a fixed height. Unlike a shrink-wrapped GridView with an aspect ratio,
/// the height does not depend on the screen width, so tiles stay compact and nothing is left empty below them.
class FixedTileGrid extends StatelessWidget {
  const FixedTileGrid({
    super.key,
    required this.children,
    this.columns = 2,
    this.tileHeight = 116,
    this.spacing = 12,
  });

  final List<Widget> children;
  final int columns;
  final double tileHeight;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var start = 0; start < children.length; start += columns) {
      final cells = <Widget>[];
      for (var i = 0; i < columns; i++) {
        if (i > 0) cells.add(SizedBox(width: spacing));
        final index = start + i;
        cells.add(Expanded(child: index < children.length ? children[index] : const SizedBox.shrink()));
      }
      rows.add(
        Padding(
          padding: EdgeInsets.only(bottom: start + columns < children.length ? spacing : 0),
          child: SizedBox(height: tileHeight, child: Row(children: cells)),
        ),
      );
    }
    return Column(children: rows);
  }
}
