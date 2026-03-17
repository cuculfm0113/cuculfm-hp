/* ==========================================================================
   CUCUL FM - Contact Form Handler
   ==========================================================================
   
   このファイルでフォームの送信処理を管理します。
   
   【設定方法】
   1. 下記の CONFIG オブジェクトで送信先メールアドレスを設定
   2. 必要に応じて送信方法を変更（mailto / API）
   
   【将来的な拡張】
   - サーバーサイド（PHP）での処理に切り替える場合は、
     SUBMIT_MODE を 'api' に変更し、API_ENDPOINT を設定してください
   ========================================================================== */

const CONFIG = {
    // 送信先メールアドレス（ここを変更してください）
    TO_EMAIL: 'cuculinfo0113@gmail.com',
    
    // 送信モード: 'mailto' または 'api'
    SUBMIT_MODE: 'mailto',
    
    // API送信の場合のエンドポイント（将来用）
    API_ENDPOINT: '/contact/send.php',
    
    // 成功メッセージ
    SUCCESS_MESSAGE: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。',
    
    // エラーメッセージ
    ERROR_MESSAGE: '送信に失敗しました。お手数ですが、直接お電話にてお問い合わせください。'
};

/* --------------------------------------------------------------------------
   Form Initialization
   -------------------------------------------------------------------------- */
function initContactForm() {
    const form = document.getElementById('contactForm');
    
    if (!form) return;
    
    form.addEventListener('submit', handleFormSubmit);
}

/* --------------------------------------------------------------------------
   Form Submit Handler
   -------------------------------------------------------------------------- */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('.btn-submit');
    const originalBtnText = submitBtn.innerHTML;
    
    // フォームデータを取得
    const formData = {
        name: form.querySelector('#name').value.trim(),
        email: form.querySelector('#email').value.trim(),
        subject: form.querySelector('#subject').value.trim() || 'お問い合わせ',
        message: form.querySelector('#message').value.trim()
    };
    
    // バリデーション
    if (!validateForm(formData)) {
        return;
    }
    
    // ボタンをローディング状態に
    submitBtn.innerHTML = '<span>送信中...</span>';
    submitBtn.disabled = true;
    
    try {
        if (CONFIG.SUBMIT_MODE === 'mailto') {
            // mailtoリンクで送信
            sendViaMailto(formData);
            showMessage(form, 'success', CONFIG.SUCCESS_MESSAGE);
            form.reset();
        } else if (CONFIG.SUBMIT_MODE === 'api') {
            // APIで送信（将来用）
            await sendViaAPI(formData);
            showMessage(form, 'success', CONFIG.SUCCESS_MESSAGE);
            form.reset();
        }
    } catch (error) {
        console.error('Form submission error:', error);
        showMessage(form, 'error', CONFIG.ERROR_MESSAGE);
    } finally {
        // ボタンを元に戻す
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}

/* --------------------------------------------------------------------------
   Validation
   -------------------------------------------------------------------------- */
function validateForm(data) {
    // 名前チェック
    if (!data.name) {
        alert('お名前を入力してください');
        return false;
    }
    
    // メールアドレスチェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
        alert('有効なメールアドレスを入力してください');
        return false;
    }
    
    // メッセージチェック
    if (!data.message) {
        alert('お問い合わせ内容を入力してください');
        return false;
    }
    
    return true;
}

/* --------------------------------------------------------------------------
   Send via Mailto
   -------------------------------------------------------------------------- */
function sendViaMailto(data) {
    const subject = encodeURIComponent(`[HP問い合わせ] ${data.subject}`);
    const body = encodeURIComponent(
        `【お名前】\n${data.name}\n\n` +
        `【メールアドレス】\n${data.email}\n\n` +
        `【お問い合わせ内容】\n${data.message}`
    );
    
    const mailtoLink = `mailto:${CONFIG.TO_EMAIL}?subject=${subject}&body=${body}`;
    
    // 新しいウィンドウでメーラーを開く
    window.location.href = mailtoLink;
}

/* --------------------------------------------------------------------------
   Send via API (Future use)
   -------------------------------------------------------------------------- */
async function sendViaAPI(data) {
    const response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('API request failed');
    }
    
    return response.json();
}

/* --------------------------------------------------------------------------
   Show Message
   -------------------------------------------------------------------------- */
function showMessage(form, type, message) {
    // 既存のメッセージを削除
    const existingMessage = form.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 新しいメッセージを作成
    const messageEl = document.createElement('div');
    messageEl.className = `form-message ${type}`;
    messageEl.textContent = message;
    
    // フォームの先頭に挿入
    form.insertBefore(messageEl, form.firstChild);
    
    // 5秒後に自動で消す
    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 300);
    }, 5000);
}

/* --------------------------------------------------------------------------
   Initialize on DOM Ready
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', initContactForm);

