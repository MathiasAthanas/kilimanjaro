import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/search_result_model.dart';
import 'notification_provider.dart';

class SearchState {
  const SearchState({
    this.query = '',
    this.isLoading = false,
    this.results = const [],
    this.recent = const [],
  });

  final String query;
  final bool isLoading;
  final List<SearchResultModel> results;
  final List<String> recent;

  SearchState copyWith({
    String? query,
    bool? isLoading,
    List<SearchResultModel>? results,
    List<String>? recent,
  }) {
    return SearchState(
      query: query ?? this.query,
      isLoading: isLoading ?? this.isLoading,
      results: results ?? this.results,
      recent: recent ?? this.recent,
    );
  }
}

class SearchController extends AutoDisposeNotifier<SearchState> {
  static const _recentKey = 'recent_searches';
  Timer? _debounce;
  var _didScheduleLoad = false;
  var _isDisposed = false;

  @override
  SearchState build() {
    if (!_didScheduleLoad) {
      _didScheduleLoad = true;
      Future<void>(_loadRecent);
    }
    ref.onDispose(() {
      _isDisposed = true;
      _debounce?.cancel();
    });
    return const SearchState();
  }

  Future<void> _loadRecent() async {
    final prefs = await SharedPreferences.getInstance();
    if (_isDisposed) return;
    final recent = prefs.getStringList(_recentKey) ?? const <String>[];
    state = state.copyWith(recent: recent);
  }

  Future<void> setQuery(String value) async {
    state = state.copyWith(query: value);
    _debounce?.cancel();
    if (value.trim().isEmpty) {
      state = state.copyWith(isLoading: false, results: const []);
      return;
    }
    state = state.copyWith(isLoading: true);
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      final query = value.trim();
      final user = await ref.read(currentUserProvider.future);
      if (user == null || state.query.trim() != query) return;
      final results = await ref.read(notificationServiceProvider).search(user, query);
      if (state.query.trim() != query) return;
      state = state.copyWith(isLoading: false, results: results);
      await _storeRecent(query);
    });
  }

  Future<void> _storeRecent(String query) async {
    final prefs = await SharedPreferences.getInstance();
    final recent = [query, ...state.recent.where((item) => item != query)].take(10).toList();
    await prefs.setStringList(_recentKey, recent);
    if (_isDisposed) return;
    state = state.copyWith(recent: recent);
  }

  Future<void> removeRecent(String query) async {
    final prefs = await SharedPreferences.getInstance();
    final recent = state.recent.where((item) => item != query).toList();
    await prefs.setStringList(_recentKey, recent);
    if (_isDisposed) return;
    state = state.copyWith(recent: recent);
  }
}

final searchControllerProvider =
    NotifierProvider.autoDispose<SearchController, SearchState>(SearchController.new);
