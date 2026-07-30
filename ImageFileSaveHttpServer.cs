using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using UnityEngine;
using UnityEngine.Events;

public class ImageFileSaveHttpServer : MonoBehaviour
{
    private const string LaunchCommandPrefix = "MF|AppLauncher|Launch|";
    private const string DynamicArtAppId = "dynamic-art";
    private const string Forest1AppId = "interactive-forest-1";
    private const string Forest2AppId = "interactive-forest-2";
    private const string PaintingRealAppId = "interactive-painting-real";
    private const string OceanAppId = "interactive-ocean";

    [Header("HTTP")]
    public int port = 11701;
    public bool keepRunningInBackground = true;

    [Header("Save")]
    public string saveDirectory = "D:\\miaowu";
    public string defaultFilePrefix = "upload";
    public string defaultExtension = ".png";

    [Header("App Launch Events")]
    public UnityEvent onDynamicArtLaunch = new UnityEvent();
    public UnityEvent onMagicForest1Launch = new UnityEvent();
    public UnityEvent onMagicForest2Launch = new UnityEvent();
    public UnityEvent onPaintingRealLaunch = new UnityEvent();
    public UnityEvent onBeautifulOceanLaunch = new UnityEvent();

    private readonly object _saveLock = new object();
    private readonly ConcurrentQueue<string> _launchRequests = new ConcurrentQueue<string>();
    private HttpListener _listener;
    private bool _isListening;
    private string _resolvedSaveDirectory;

    private struct UploadedFile
    {
        public byte[] bytes;
        public string fileName;
        public string contentType;
    }

    private struct SavedFile
    {
        public string fullPath;
        public long length;
    }

    private void Start()
    {
        if (keepRunningInBackground)
            Application.runInBackground = true;

        _resolvedSaveDirectory = ResolveSaveDirectory();

        try
        {
            Directory.CreateDirectory(_resolvedSaveDirectory);

            _listener = new HttpListener();
            _listener.Prefixes.Add($"http://*:{port}/");
            _listener.Start();
            _isListening = true;
            BeginListen();

            Debug.Log($"Image file save server started: port={port}, path={_resolvedSaveDirectory}");
        }
        catch (Exception e)
        {
            _isListening = false;
            Debug.LogError($"Image file save server start failed: {e.Message}");
        }
    }

    private void BeginListen()
    {
        if (!_isListening || _listener == null)
            return;

        try
        {
            _listener.BeginGetContext(OnRequestReceived, null);
        }
        catch (Exception e)
        {
            if (_isListening)
                Debug.LogError($"Image file save server listen failed: {e.Message}");
        }
    }

    private void OnRequestReceived(IAsyncResult result)
    {
        HttpListenerContext context = null;

        try
        {
            if (!_isListening || _listener == null)
                return;

            context = _listener.EndGetContext(result);
            BeginListen();

            byte[] rawData;
            using (var ms = new MemoryStream())
            {
                context.Request.InputStream.CopyTo(ms);
                rawData = ms.ToArray();
            }

            if (IsTextCommandContentType(context.Request.ContentType))
            {
                if (TryQueueLaunchCommand(rawData))
                    WriteResponse(context.Response, 202, "Accepted");
                else
                    WriteResponse(context.Response, 400, "Invalid app launch command.");

                return;
            }

            List<UploadedFile> images = ExtractImages(rawData, context.Request.ContentType);
            if (images.Count == 0)
            {
                WriteResponse(context.Response, 415, "No image file found.");
                return;
            }

            List<SavedFile> savedFiles = new List<SavedFile>();
            foreach (UploadedFile image in images)
                savedFiles.Add(SaveUploadedFile(image));

            WriteResponse(context.Response, 200, BuildSuccessMessage(savedFiles));
        }
        catch (ObjectDisposedException)
        {
        }
        catch (HttpListenerException e)
        {
            if (_isListening)
                Debug.LogError($"Image file save request failed: {e.Message}");
        }
        catch (Exception e)
        {
            Debug.LogError($"Image file save request failed: {e.Message}");

            if (context != null)
                WriteResponse(context.Response, 500, e.Message);
        }
    }

    private void Update()
    {
        string appId;
        while (_launchRequests.TryDequeue(out appId))
            InvokeLaunchEvent(appId);
    }

    private bool IsTextCommandContentType(string contentType)
    {
        return !string.IsNullOrWhiteSpace(contentType) &&
               contentType.Trim().StartsWith("text/plain", StringComparison.OrdinalIgnoreCase);
    }

    private bool TryQueueLaunchCommand(byte[] rawData)
    {
        if (rawData == null || rawData.Length == 0)
            return false;

        string command = Encoding.UTF8.GetString(rawData).Trim();
        if (!command.StartsWith(LaunchCommandPrefix, StringComparison.Ordinal))
            return false;

        string appId = command.Substring(LaunchCommandPrefix.Length).Trim();
        if (!IsKnownAppId(appId))
            return false;

        _launchRequests.Enqueue(appId);
        return true;
    }

    private bool IsKnownAppId(string appId)
    {
        return appId == DynamicArtAppId ||
               appId == Forest1AppId ||
               appId == Forest2AppId ||
               appId == PaintingRealAppId ||
               appId == OceanAppId;
    }

    private void InvokeLaunchEvent(string appId)
    {
        Debug.Log($"App launch requested: {appId}");

        switch (appId)
        {
            case DynamicArtAppId:
                onDynamicArtLaunch?.Invoke();
                break;
            case Forest1AppId:
                onMagicForest1Launch?.Invoke();
                break;
            case Forest2AppId:
                onMagicForest2Launch?.Invoke();
                break;
            case PaintingRealAppId:
                onPaintingRealLaunch?.Invoke();
                break;
            case OceanAppId:
                onBeautifulOceanLaunch?.Invoke();
                break;
        }
    }

    private List<UploadedFile> ExtractImages(byte[] rawData, string contentType)
    {
        List<UploadedFile> images = new List<UploadedFile>();
        string safeContentType = contentType ?? "";

        if (safeContentType.IndexOf("multipart/form-data", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            images.AddRange(ParseMultipartImages(rawData, safeContentType));
            return images;
        }

        if (IsImageContentType(safeContentType) || LooksLikeImage(rawData))
        {
            images.Add(new UploadedFile
            {
                bytes = rawData,
                fileName = "",
                contentType = safeContentType
            });
        }

        return images;
    }

    private List<UploadedFile> ParseMultipartImages(byte[] rawData, string contentType)
    {
        List<UploadedFile> images = new List<UploadedFile>();
        string boundary = GetBoundary(contentType);
        if (string.IsNullOrEmpty(boundary))
            return images;

        byte[] boundaryBytes = Encoding.UTF8.GetBytes(boundary);
        byte[] headerSeparator = Encoding.UTF8.GetBytes("\r\n\r\n");

        int boundaryPos = FindBytes(rawData, boundaryBytes, 0);
        while (boundaryPos >= 0)
        {
            int partStart = boundaryPos + boundaryBytes.Length;
            if (partStart + 1 < rawData.Length && rawData[partStart] == '-' && rawData[partStart + 1] == '-')
                break;

            if (partStart + 1 < rawData.Length && rawData[partStart] == '\r' && rawData[partStart + 1] == '\n')
                partStart += 2;

            int headerEnd = FindBytes(rawData, headerSeparator, partStart);
            if (headerEnd < 0)
                break;

            string headers = Encoding.UTF8.GetString(rawData, partStart, headerEnd - partStart);
            int dataStart = headerEnd + headerSeparator.Length;
            int nextBoundary = FindBytes(rawData, boundaryBytes, dataStart);
            if (nextBoundary < 0)
                break;

            int dataEnd = nextBoundary;
            if (dataEnd >= dataStart + 2 && rawData[dataEnd - 2] == '\r' && rawData[dataEnd - 1] == '\n')
                dataEnd -= 2;
            else if (dataEnd > dataStart && rawData[dataEnd - 1] == '\n')
                dataEnd -= 1;

            int dataLength = dataEnd - dataStart;
            if (dataLength > 0)
            {
                byte[] fileBytes = new byte[dataLength];
                Array.Copy(rawData, dataStart, fileBytes, 0, dataLength);

                string fileName = GetMultipartFileName(headers);
                string fileContentType = GetMultipartContentType(headers);
                if (IsImageContentType(fileContentType) || HasImageExtension(fileName) || LooksLikeImage(fileBytes))
                {
                    images.Add(new UploadedFile
                    {
                        bytes = fileBytes,
                        fileName = fileName,
                        contentType = fileContentType
                    });
                }
            }

            boundaryPos = nextBoundary;
        }

        return images;
    }

    private SavedFile SaveUploadedFile(UploadedFile image)
    {
        if (image.bytes == null || image.bytes.Length == 0)
            throw new InvalidOperationException("Image data is empty.");

        lock (_saveLock)
        {
            Directory.CreateDirectory(_resolvedSaveDirectory);

            string fileName = BuildFileName(image);
            string fullPath = MakeUniqueFilePath(_resolvedSaveDirectory, fileName);
            File.WriteAllBytes(fullPath, image.bytes);

            Debug.Log($"Image saved: {fullPath}");
            return new SavedFile
            {
                fullPath = fullPath,
                length = image.bytes.Length
            };
        }
    }

    private string BuildFileName(UploadedFile image)
    {
        string rawName = ExtractPlainFileName(image.fileName);
        string baseName = "";
        string extension = "";

        if (!string.IsNullOrEmpty(rawName))
        {
            baseName = Path.GetFileNameWithoutExtension(rawName);
            extension = Path.GetExtension(rawName);
        }

        if (string.IsNullOrWhiteSpace(baseName))
            baseName = $"{defaultFilePrefix}_{DateTime.Now:yyyyMMdd_HHmmss_fff}";

        if (string.IsNullOrWhiteSpace(extension))
            extension = GetExtensionFromContentType(image.contentType);

        if (string.IsNullOrWhiteSpace(extension))
            extension = GetExtensionFromBytes(image.bytes);

        if (string.IsNullOrWhiteSpace(extension))
            extension = NormalizeExtension(defaultExtension);

        return SanitizeFileName(baseName) + NormalizeExtension(extension);
    }

    private string MakeUniqueFilePath(string directory, string fileName)
    {
        string baseName = Path.GetFileNameWithoutExtension(fileName);
        string extension = Path.GetExtension(fileName);
        string fullPath = Path.Combine(directory, fileName);

        if (!File.Exists(fullPath))
            return fullPath;

        for (int i = 1; i <= 9999; i++)
        {
            string candidate = Path.Combine(directory, $"{baseName}_{i:000}{extension}");
            if (!File.Exists(candidate))
                return candidate;
        }

        throw new IOException("Could not create a unique file name.");
    }

    private string ResolveSaveDirectory()
    {
        if (!string.IsNullOrWhiteSpace(saveDirectory))
            return Path.GetFullPath(saveDirectory);

        return Path.Combine(Application.persistentDataPath, "UploadedImages");
    }

    private string BuildSuccessMessage(List<SavedFile> savedFiles)
    {
        StringBuilder builder = new StringBuilder();
        builder.AppendLine("OK");

        foreach (SavedFile file in savedFiles)
            builder.AppendLine($"{file.length} bytes -> {file.fullPath}");

        return builder.ToString();
    }

    private void WriteResponse(HttpListenerResponse response, int statusCode, string text)
    {
        if (response == null)
            return;

        try
        {
            byte[] buffer = Encoding.UTF8.GetBytes(text ?? "");
            response.StatusCode = statusCode;
            response.ContentType = "text/plain; charset=utf-8";
            response.ContentLength64 = buffer.Length;
            response.OutputStream.Write(buffer, 0, buffer.Length);
        }
        catch (Exception e)
        {
            Debug.LogError($"Image file save response failed: {e.Message}");
        }
        finally
        {
            response.Close();
        }
    }

    private string GetBoundary(string contentType)
    {
        string[] parts = contentType.Split(';');
        foreach (string part in parts)
        {
            string trimmed = part.Trim();
            if (!trimmed.StartsWith("boundary=", StringComparison.OrdinalIgnoreCase))
                continue;

            string boundary = trimmed.Substring("boundary=".Length).Trim().Trim('"');
            if (boundary.StartsWith("--", StringComparison.Ordinal))
                return boundary;

            return "--" + boundary;
        }

        return "";
    }

    private string GetMultipartFileName(string headers)
    {
        string disposition = GetHeaderLine(headers, "Content-Disposition");
        return GetHeaderParameter(disposition, "filename");
    }

    private string GetMultipartContentType(string headers)
    {
        return GetHeaderLine(headers, "Content-Type");
    }

    private string GetHeaderLine(string headers, string headerName)
    {
        string[] lines = headers.Split(new[] { "\r\n" }, StringSplitOptions.None);
        foreach (string line in lines)
        {
            int colonIndex = line.IndexOf(':');
            if (colonIndex < 0)
                continue;

            string name = line.Substring(0, colonIndex).Trim();
            if (string.Equals(name, headerName, StringComparison.OrdinalIgnoreCase))
                return line.Substring(colonIndex + 1).Trim();
        }

        return "";
    }

    private string GetHeaderParameter(string headerValue, string parameterName)
    {
        string[] parts = headerValue.Split(';');
        foreach (string part in parts)
        {
            string trimmed = part.Trim();
            string prefix = parameterName + "=";
            if (!trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                continue;

            return trimmed.Substring(prefix.Length).Trim().Trim('"');
        }

        return "";
    }

    private string ExtractPlainFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return "";

        string normalized = fileName.Replace('\\', '/');
        int slashIndex = normalized.LastIndexOf('/');
        if (slashIndex >= 0 && slashIndex + 1 < normalized.Length)
            normalized = normalized.Substring(slashIndex + 1);

        return normalized.Trim();
    }

    private string SanitizeFileName(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            value = defaultFilePrefix;

        char[] invalidChars = Path.GetInvalidFileNameChars();
        StringBuilder builder = new StringBuilder(value.Length);
        foreach (char c in value)
        {
            bool invalid = c < 32 || Array.IndexOf(invalidChars, c) >= 0;
            builder.Append(invalid ? '_' : c);
        }

        string result = builder.ToString().Trim();
        if (string.IsNullOrEmpty(result))
            result = defaultFilePrefix;

        string upper = result.ToUpperInvariant();
        if (upper == "CON" || upper == "PRN" || upper == "AUX" || upper == "NUL" ||
            upper == "COM1" || upper == "COM2" || upper == "COM3" || upper == "COM4" ||
            upper == "COM5" || upper == "COM6" || upper == "COM7" || upper == "COM8" ||
            upper == "COM9" || upper == "LPT1" || upper == "LPT2" || upper == "LPT3" ||
            upper == "LPT4" || upper == "LPT5" || upper == "LPT6" || upper == "LPT7" ||
            upper == "LPT8" || upper == "LPT9")
        {
            result += "_";
        }

        return result;
    }

    private bool IsImageContentType(string contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
            return false;

        return contentType.Trim().StartsWith("image/", StringComparison.OrdinalIgnoreCase);
    }

    private bool HasImageExtension(string fileName)
    {
        string extension = Path.GetExtension(ExtractPlainFileName(fileName)).ToLowerInvariant();
        return extension == ".png" ||
               extension == ".jpg" ||
               extension == ".jpeg" ||
               extension == ".gif" ||
               extension == ".webp" ||
               extension == ".bmp";
    }

    private bool LooksLikeImage(byte[] bytes)
    {
        if (bytes == null || bytes.Length < 4)
            return false;

        bool png = bytes.Length >= 8 &&
                   bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
        bool jpg = bytes[0] == 0xFF && bytes[1] == 0xD8;
        bool gif = bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38;
        bool bmp = bytes[0] == 0x42 && bytes[1] == 0x4D;
        bool webp = bytes.Length >= 12 &&
                    bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
                    bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;

        return png || jpg || gif || bmp || webp;
    }

    private string GetExtensionFromContentType(string contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
            return "";

        string normalized = contentType.Split(';')[0].Trim().ToLowerInvariant();
        switch (normalized)
        {
            case "image/png":
                return ".png";
            case "image/jpeg":
            case "image/jpg":
                return ".jpg";
            case "image/gif":
                return ".gif";
            case "image/webp":
                return ".webp";
            case "image/bmp":
                return ".bmp";
            default:
                return "";
        }
    }

    private string GetExtensionFromBytes(byte[] bytes)
    {
        if (bytes == null || bytes.Length < 4)
            return "";

        if (bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            return ".png";

        if (bytes[0] == 0xFF && bytes[1] == 0xD8)
            return ".jpg";

        if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38)
            return ".gif";

        if (bytes[0] == 0x42 && bytes[1] == 0x4D)
            return ".bmp";

        if (bytes.Length >= 12 &&
            bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
            bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50)
        {
            return ".webp";
        }

        return "";
    }

    private string NormalizeExtension(string extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
            return ".png";

        string normalized = extension.Trim().ToLowerInvariant();
        if (!normalized.StartsWith(".", StringComparison.Ordinal))
            normalized = "." + normalized;

        return normalized;
    }

    private int FindBytes(byte[] source, byte[] search, int startIndex)
    {
        if (source == null || search == null || search.Length == 0)
            return -1;

        for (int i = startIndex; i <= source.Length - search.Length; i++)
        {
            bool match = true;
            for (int j = 0; j < search.Length; j++)
            {
                if (source[i + j] != search[j])
                {
                    match = false;
                    break;
                }
            }

            if (match)
                return i;
        }

        return -1;
    }

    private void OnDestroy()
    {
        StopServer();
    }

    private void OnApplicationQuit()
    {
        StopServer();
    }

    private void StopServer()
    {
        _isListening = false;

        if (_listener == null)
            return;

        try
        {
            _listener.Stop();
            _listener.Close();
        }
        catch (Exception e)
        {
            Debug.LogError($"Image file save server stop failed: {e.Message}");
        }
        finally
        {
            _listener = null;
        }
    }
}
