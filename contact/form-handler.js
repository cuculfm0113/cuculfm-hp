/* ==========================================================================
   CUCUL FM - お問い合わせフォーム送信（Netlify Forms）
   ==========================================================================

   送信先の設定はこのファイルには無い。
   ・フォームの検出とひも付けは静的HTML側の
       <form name="contact" data-netlify="true" netlify-honeypot="bot-field">
       + <input type="hidden" name="form-name" value="contact">
     が担う（Netlify はデプロイ時にHTMLを解析してフォームを登録する）
   ・通知先メールアドレスは Netlify 管理画面 → Forms → Form notifications で設定する
     （content/site.config.json の contact.notifyEmail が正。手順は docs/redesign/07-update-guide.md）

   画面に出す文言・フォーム名・honeypot 名は、HTML 内の
     <script type="application/json" id="contact-config">
   から読む。中身は content/site.config.json から build-content.mjs が生成する。
   見つからない場合は下の DEFAULTS で動く。

   検証の方針:
   ・HTML には required / type="email" を残してある = JS 無効でもブラウザが検証する
   ・JS が動くときは noValidate を立てて、この中の検証とインライン表示に切り替える
     （alert は使わない）
   ========================================================================== */

(function () {
    'use strict';

    var DEFAULTS = {
        formName: 'contact',
        honeypot: 'bot-field',
        messages: {
            required: '入力してください',
            requiredSelect: '選択してください',
            requiredCheck: '同意が必要です',
            email: 'メールアドレスの形式が正しくありません',
            submitting: '送信中...',
            success: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。',
            failure: '送信に失敗しました。お手数ですが、お電話でご連絡ください。'
        }
    };

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    var CFG = readConfig();

    /* ----------------------------------------------------------------------
       設定の読み込み
       ---------------------------------------------------------------------- */
    function readConfig() {
        var el = document.getElementById('contact-config');
        if (!el) { return DEFAULTS; }
        try {
            var raw = JSON.parse(el.textContent);
            var messages = {};
            var k;
            for (k in DEFAULTS.messages) {
                if (Object.prototype.hasOwnProperty.call(DEFAULTS.messages, k)) {
                    messages[k] = (raw.messages && raw.messages[k]) || DEFAULTS.messages[k];
                }
            }
            return {
                formName: raw.formName || DEFAULTS.formName,
                honeypot: raw.honeypot || DEFAULTS.honeypot,
                messages: messages
            };
        } catch (e) {
            return DEFAULTS;
        }
    }

    /* ----------------------------------------------------------------------
       計測（js/analytics.js があればそちらへ、無ければ直接 dataLayer へ）
       ---------------------------------------------------------------------- */
    function track(name, params) {
        try {
            if (window.CUCULFM && typeof window.CUCULFM.track === 'function') {
                window.CUCULFM.track(name, params);
                return;
            }
            window.dataLayer = window.dataLayer || [];
            var payload = { event: name };
            var k;
            for (k in params) {
                if (Object.prototype.hasOwnProperty.call(params, k)) { payload[k] = params[k]; }
            }
            window.dataLayer.push(payload);
        } catch (e) { /* 計測の失敗で送信を止めない */ }
    }

    /* ----------------------------------------------------------------------
       項目ごとのエラー表示（alert は使わない）
       ---------------------------------------------------------------------- */
    function errorBox(field) {
        return document.getElementById('err-' + field.name);
    }

    function setError(field, message) {
        var box = errorBox(field);
        field.setAttribute('aria-invalid', 'true');
        field.classList.add('is-invalid');
        if (box) {
            box.textContent = message;
            box.hidden = false;
        }
    }

    function clearError(field) {
        var box = errorBox(field);
        field.removeAttribute('aria-invalid');
        field.classList.remove('is-invalid');
        if (box) {
            box.textContent = '';
            box.hidden = true;
        }
    }

    /** 検証対象の入力欄（hidden と honeypot は除く） */
    function controlsOf(form) {
        var all = form.querySelectorAll('input[name], select[name], textarea[name]');
        var out = [];
        Array.prototype.forEach.call(all, function (el) {
            if (el.type === 'hidden') { return; }
            if (el.name === CFG.honeypot) { return; }
            out.push(el);
        });
        return out;
    }

    /** @returns {Array} 問題のあった入力欄（空なら検証通過） */
    function validate(form) {
        var msgs = CFG.messages;
        var invalid = [];
        controlsOf(form).forEach(function (el) {
            clearError(el);
            var value = el.type === 'checkbox' ? '' : String(el.value || '').trim();

            if (el.required) {
                var empty = el.type === 'checkbox' ? !el.checked : !value;
                if (empty) {
                    setError(el, el.type === 'checkbox' ? msgs.requiredCheck
                        : el.tagName === 'SELECT' ? msgs.requiredSelect
                            : msgs.required);
                    invalid.push(el);
                    return;
                }
            }
            /* 任意項目でも、入っているなら形式は確かめる */
            if (el.type === 'email' && value && !EMAIL_RE.test(value)) {
                setError(el, msgs.email);
                invalid.push(el);
            }
        });
        return invalid;
    }

    /* ----------------------------------------------------------------------
       送信結果のメッセージ（フォーム先頭に出す。自動では消さない）
       ---------------------------------------------------------------------- */
    function showMessage(form, type, message) {
        var existing = form.querySelector('.form-message');
        if (existing) { existing.remove(); }

        var el = document.createElement('div');
        el.className = 'form-message ' + type;
        el.setAttribute('role', type === 'error' ? 'alert' : 'status');
        el.textContent = message;
        form.insertBefore(el, form.firstChild);
        return el;
    }

    /* ----------------------------------------------------------------------
       送信（application/x-www-form-urlencoded で Netlify へ POST）
       ---------------------------------------------------------------------- */
    function encodeForm(form) {
        var data = new FormData(form);
        var pairs = [];
        data.forEach(function (value, key) {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        });
        return pairs.join('&');
    }

    function handleSubmit(e) {
        e.preventDefault();

        var form = e.target;
        var msgs = CFG.messages;

        var invalid = validate(form);
        if (invalid.length) {
            /* 画面内のどこが悪いのかはインライン表示が伝えるので、
               ここでは最初の項目へ移動するだけにする */
            invalid[0].focus();
            if (typeof invalid[0].scrollIntoView === 'function') {
                invalid[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            return;
        }

        var button = form.querySelector('.btn-submit');
        var original = button ? button.innerHTML : '';
        if (button) {
            button.disabled = true;
            button.textContent = msgs.submitting;
        }

        track('contact_form_submit', { form_name: CFG.formName });

        fetch(form.getAttribute('action') || '/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: encodeForm(form)
        }).then(function (res) {
            if (!res.ok) { throw new Error('HTTP ' + res.status); }
            showMessage(form, 'success', msgs.success);
            track('contact_form_success', { form_name: CFG.formName });
            form.reset();
            controlsOf(form).forEach(clearError);
        }).catch(function (err) {
            showMessage(form, 'error', msgs.failure);
            track('contact_form_error', {
                form_name: CFG.formName,
                error_message: String((err && err.message) || err)
            });
        }).then(function () {
            if (button) {
                button.disabled = false;
                button.innerHTML = original;
            }
        });
    }

    /* ----------------------------------------------------------------------
       初期化
       ---------------------------------------------------------------------- */
    function initContactForm() {
        var form = document.getElementById('contactForm');
        if (!form) { return; }

        /* JS が動くのでブラウザ標準のバブル表示は止め、こちらの表示に一本化する */
        form.noValidate = true;

        form.addEventListener('submit', handleSubmit);

        /* 一度エラーになった項目は、直したそばから消す */
        controlsOf(form).forEach(function (el) {
            var event = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
            el.addEventListener(event, function () {
                if (el.classList.contains('is-invalid')) { clearError(el); }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initContactForm);
    } else {
        initContactForm();
    }
}());
