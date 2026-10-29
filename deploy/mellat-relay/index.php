<?php
// Mellat (Behpardakht) relay for OBH, hosted in Iran next to the Sadad relay
// (e.g. https://ir.obhco.ir/mellat/). Behpardakht only accepts whitelisted
// Iranian IPs, so OBH posts its SOAP calls here and this file forwards them
// to bpm.shaparak.ir. Register THIS host's IP with Behpardakht.
// Only the four operations OBH uses are forwarded, and only with the shared
// secret. Nothing is stored or logged.

// Must equal BEHPARDAKHT_RELAY_SECRET (or SADAD_RELAY_SECRET) in OBH's .env.production.
const RELAY_SECRET = 'CHANGE_ME';
const MELLAT_SOAP = 'https://bpm.shaparak.ir/pgwchannel/services/pgw';
const ALLOWED = ['bpPayRequest', 'bpVerifyRequest', 'bpSettleRequest', 'bpInquiryRequest'];

function fail($status, $message) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
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

$body = file_get_contents('php://input');
if ($body === false || strlen($body) > 16384) {
    fail(400, 'bad body');
}

// The SOAP body must call exactly one allowed operation.
if (!preg_match('/<int:(bp[A-Za-z]+)>/', $body, $match) || !in_array($match[1], ALLOWED, true)) {
    fail(404, 'unknown operation');
}

$ch = curl_init(MELLAT_SOAP);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => ['Content-Type: text/xml; charset=utf-8', 'SOAPAction: ""'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 14,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
if ($response === false) {
    $error = curl_error($ch);
    curl_close($ch);
    fail(502, 'mellat unreachable: ' . $error);
}
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($status);
header('Content-Type: text/xml; charset=utf-8');
echo $response;
