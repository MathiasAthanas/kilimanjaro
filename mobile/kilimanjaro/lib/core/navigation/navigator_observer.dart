import 'package:flutter/material.dart';

class ShellNavigatorObserver extends NavigatorObserver {
  int overlayDepth = 0;

  bool get hasOverlayRoute => overlayDepth > 0;

  bool _counts(Route<dynamic> route) {
    return route is PopupRoute || route is DialogRoute || route is RawDialogRoute;
  }

  @override
  void didPush(Route route, Route? previousRoute) {
    if (_counts(route)) {
      overlayDepth += 1;
    }
    super.didPush(route, previousRoute);
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    if (_counts(route) && overlayDepth > 0) {
      overlayDepth -= 1;
    }
    super.didPop(route, previousRoute);
  }
}
