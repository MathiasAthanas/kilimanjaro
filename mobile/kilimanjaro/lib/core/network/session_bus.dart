import 'dart:async';

/// A process-wide signal that the authenticated session has ended and the user
/// must sign in again.
///
/// The refresh interceptor emits [SessionEvent.expired] after a failed token
/// refresh; the app shell listens and routes to the login screen. Using a bus
/// (rather than passing a Riverpod `ref` into every service) keeps service
/// constructors unchanged while still giving us one place to react.
enum SessionEvent { expired }

class SessionBus {
  SessionBus._();

  static final SessionBus instance = SessionBus._();

  final StreamController<SessionEvent> _controller =
      StreamController<SessionEvent>.broadcast();

  Stream<SessionEvent> get stream => _controller.stream;

  DateTime? _lastEmit;

  /// Signals an expired session. Debounced so a burst of concurrent 401s from
  /// several in-flight requests only routes to login once.
  void emitExpired() {
    final now = DateTime.now();
    if (_lastEmit != null &&
        now.difference(_lastEmit!) < const Duration(seconds: 2)) {
      return;
    }
    _lastEmit = now;
    if (!_controller.isClosed) {
      _controller.add(SessionEvent.expired);
    }
  }
}
