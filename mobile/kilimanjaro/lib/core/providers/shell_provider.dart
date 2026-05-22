import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/rendering.dart';

class ShellState {
  const ShellState({
    this.navBarHeight = 104,
    this.isDrawerOpen = false,
    this.isNavBarVisible = true,
    this.activeTabIndex = 0,
    this.lastScrollDirection = ScrollDirection.idle,
  });

  final double navBarHeight;
  final bool isDrawerOpen;
  final bool isNavBarVisible;
  final int activeTabIndex;
  final ScrollDirection lastScrollDirection;

  ShellState copyWith({
    double? navBarHeight,
    bool? isDrawerOpen,
    bool? isNavBarVisible,
    int? activeTabIndex,
    ScrollDirection? lastScrollDirection,
  }) {
    return ShellState(
      navBarHeight: navBarHeight ?? this.navBarHeight,
      isDrawerOpen: isDrawerOpen ?? this.isDrawerOpen,
      isNavBarVisible: isNavBarVisible ?? this.isNavBarVisible,
      activeTabIndex: activeTabIndex ?? this.activeTabIndex,
      lastScrollDirection: lastScrollDirection ?? this.lastScrollDirection,
    );
  }
}

class ShellController extends Notifier<ShellState> {
  @override
  ShellState build() => const ShellState();

  void setNavBarHeight(double value) {
    state = state.copyWith(navBarHeight: value);
  }

  void openDrawer() {
    state = state.copyWith(isDrawerOpen: true);
  }

  void closeDrawer() {
    state = state.copyWith(isDrawerOpen: false);
  }

  void setTabIndex(int index) {
    state = state.copyWith(activeTabIndex: index);
  }

  void setNavBarVisible(bool value) {
    state = state.copyWith(isNavBarVisible: value);
  }

  void setScrollDirection(ScrollDirection direction) {
    state = state.copyWith(lastScrollDirection: direction);
  }
}

final shellControllerProvider =
    NotifierProvider<ShellController, ShellState>(ShellController.new);
