<?php
/* ==========================================================================
   CUCUL FM - Contact Form Server-Side Handler
   ==========================================================================
   
   【使い方】
   1. このファイルをサーバーにアップロード
   2. 下記の設定を変更
   3. form-handler.js の SUBMIT_MODE を 'api' に変更
   
   ========================================================================== */

// ============================================================================
// 設定
// ============================================================================
$config = [
    // 送信先メールアドレス
    'to_email' => 'contact@cuculfm.info',
    
    // 送信元の名前
    'from_name' => 'CUCUL FM ウェブサイト',
    
    // 件名のプレフィックス
    'subject_prefix' => '[HP問い合わせ]'
];

// ============================================================================
// CORS設定（必要に応じて調整）
// ============================================================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONSリクエストの場合は早期リターン
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================================================
// POSTリクエストのみ受け付け
// ============================================================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ============================================================================
// JSONデータを取得
// ============================================================================
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// ============================================================================
// バリデーション
// ============================================================================
$errors = [];

if (empty($data['name'])) {
    $errors[] = 'お名前は必須です';
}

if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    $errors[] = '有効なメールアドレスを入力してください';
}

if (empty($data['message'])) {
    $errors[] = 'お問い合わせ内容は必須です';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['error' => implode(', ', $errors)]);
    exit;
}

// ============================================================================
// メール送信
// ============================================================================
$name = htmlspecialchars($data['name'], ENT_QUOTES, 'UTF-8');
$email = htmlspecialchars($data['email'], ENT_QUOTES, 'UTF-8');
$subject = htmlspecialchars($data['subject'] ?? 'お問い合わせ', ENT_QUOTES, 'UTF-8');
$message = htmlspecialchars($data['message'], ENT_QUOTES, 'UTF-8');

$mail_subject = "{$config['subject_prefix']} {$subject}";

$mail_body = <<<EOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ホームページからのお問い合わせ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【お名前】
{$name}

【メールアドレス】
{$email}

【件名】
{$subject}

【お問い合わせ内容】
{$message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
送信日時: {$_SERVER['REQUEST_TIME']}
IPアドレス: {$_SERVER['REMOTE_ADDR']}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOT;

$headers = [
    'From' => "{$config['from_name']} <{$config['to_email']}>",
    'Reply-To' => "{$name} <{$email}>",
    'Content-Type' => 'text/plain; charset=UTF-8'
];

$header_string = '';
foreach ($headers as $key => $value) {
    $header_string .= "{$key}: {$value}\r\n";
}

// メール送信
$result = mail($config['to_email'], $mail_subject, $mail_body, $header_string);

if ($result) {
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'お問い合わせを受け付けました']);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'メール送信に失敗しました']);
}

