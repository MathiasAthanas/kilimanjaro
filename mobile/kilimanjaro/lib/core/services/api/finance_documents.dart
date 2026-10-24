import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';

import '../../network/api_client.dart';
import '../../network/api_failure.dart';

/// Downloads invoice and receipt PDFs with the user's own session and hands them to the device's PDF viewer.
class FinanceDocuments {
  FinanceDocuments(FlutterSecureStorage storage) : _dio = buildApiClient(storage);

  final Dio _dio;

  /// [path] is a gateway path such as `/finance/receipts/<id>/pdf`.
  Future<void> open(String path, String fileName) async {
    try {
      final response = await _dio.get<List<int>>(path, options: Options(responseType: ResponseType.bytes));
      final bytes = response.data;
      if (bytes == null || bytes.isEmpty) {
        throw const ApiFailure(kind: ApiFailureKind.notFound, message: 'The school has not produced this PDF yet.');
      }
      final dir = await getTemporaryDirectory();
      final safeName = fileName.replaceAll(RegExp(r'[^\w.\-]+'), '_');
      final file = File('${dir.path}/$safeName');
      await file.writeAsBytes(bytes, flush: true);
      final result = await OpenFile.open(file.path);
      if (result.type != ResultType.done) {
        throw const ApiFailure(
          kind: ApiFailureKind.unknown,
          message: 'No PDF viewer is installed on this device. Install one to open the document.',
        );
      }
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }
}
