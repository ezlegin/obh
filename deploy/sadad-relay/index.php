<?php
// Sadad relay for OBH, hosted in Iran (https://ir.obhco.ir/sadad/).
// Shaparak drops connections from foreign IPs, so OBH sends its two
// server-to-server calls here and this file forwards them to Sadad.
// Only those two endpoints are forwarded, and only with the shared secret.
// Nothing is stored or logged.

// Must equal SADAD_RELAY_SECRET in OBH's .env.production.
const RELAY_SECRET = 'CHANGE_ME';
const SADAD_BASE = 'https://sadad.shaparak.ir';
const ALLOWED = ['api/v0/Request/PaymentRequest', 'api/v0/Advice/Verify'];

header('Content-Type: application/json; charset=utf-8');

function fail($status, $message) {
    http_response_code($status);
    echo json_encode(['relayError' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'POST only');
}
$secret = $_SERVER['HTTP_X_RELAY_SECRET'] ?? '';
if (strlen(RELAY_SECRET) < 32 || RELAY_SECRET === 'CHANGE_ME' || !hash_equals(RELAY_SECRET, $secret)) {
    fail(403, 'forbidden');
}

// .htaccess rewrites /sadad/<path> to index.php?path=<path>.
$path = trim($_GET['path'] ?? '', '/');
if (!in_array($path, ALLOWED, true)) {
    fail(404, 'unknown endpoint');
}

$body = file_get_contents('php://input');
if ($body === false || strlen($body) > 16384) {
    fail(400, 'bad body');
}

$ch = curl_init(SADAD_BASE . '/' . $path);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 14,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
if ($response === false) {
    $error = curl_error($ch);
    curl_close($ch);
    fail(502, 'sadad unreachable: ' . $error);
}
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($status);
echo $response;
