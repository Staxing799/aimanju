import { useEffect, useRef, useState } from 'react';
import brandMark from '../../assets/login/hero-mark.png';
import brandTagline from '../../assets/login/born-for-passion.png';
import styles from './LoginPage.module.less';

// 登录页只负责收集凭据，实际鉴权仍交由应用层处理。
function LoginPage({ onLogin, loading = false }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [credentialsUnlocked, setCredentialsUnlocked] = useState(false);
  const accountInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    const lockAndClearCredentials = () => {
      setAccount('');
      setPassword('');
      setCredentialsUnlocked(false);

      // Reset the DOM synchronously before a page is cached/restored. The inputs
      // remain read-only until the next deliberate user interaction, so the
      // browser cannot paint restored credentials before React clears them.
      if (accountInputRef.current) {
        accountInputRef.current.value = '';
        accountInputRef.current.readOnly = true;
      }
      if (passwordInputRef.current) {
        passwordInputRef.current.value = '';
        passwordInputRef.current.readOnly = true;
      }
    };

    window.addEventListener('pagehide', lockAndClearCredentials);
    window.addEventListener('pageshow', lockAndClearCredentials);

    return () => {
      window.removeEventListener('pagehide', lockAndClearCredentials);
      window.removeEventListener('pageshow', lockAndClearCredentials);
    };
  }, []);

  function unlockCredentials() {
    if (credentialsUnlocked) {
      return;
    }

    // Pointer-down and key-down run before the browser performs its default
    // focus/input action. Removing readOnly synchronously keeps the initial
    // paint empty while still allowing the native saved-account picker.
    if (accountInputRef.current) {
      accountInputRef.current.readOnly = false;
    }
    if (passwordInputRef.current) {
      passwordInputRef.current.readOnly = false;
    }
    setCredentialsUnlocked(true);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onLogin({ account, password });
  }

  return (
    <main className={styles.page}>
      <div className={styles.vignette} aria-hidden="true" />

      <section className={styles.loginStage} aria-label="账号登录">
        <form
          className={styles.loginForm}
          onSubmit={handleSubmit}
          autoComplete="on"
          aria-busy={loading}
        >
          <div className={styles.brandLockup}>
            <img className={styles.brandMark} src={brandMark} alt="品牌标志" />
            <img
              className={styles.brandTagline}
              src={brandTagline}
              alt="Born for Passion"
            />
          </div>

          <div className={styles.fields}>
            <label className={styles.fieldLabel} htmlFor="login-account">
              用户名
              <span className={styles.inputShell}>
                <input
                  ref={accountInputRef}
                  id="login-account"
                  name="username"
                  type="text"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="用户名"
                  autoComplete="username"
                  readOnly={!credentialsUnlocked}
                  onPointerDownCapture={unlockCredentials}
                  onKeyDownCapture={unlockCredentials}
                  onFocus={unlockCredentials}
                  disabled={loading}
                  required
                />
              </span>
            </label>

            <div className={`${styles.inputShell} ${styles.passwordShell}`}>
              <label className={`${styles.fieldLabel} ${styles.passwordField}`} htmlFor="login-password">
                密码
                <input
                  ref={passwordInputRef}
                  id="login-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="密码"
                  autoComplete="current-password"
                  readOnly={!credentialsUnlocked}
                  onPointerDownCapture={unlockCredentials}
                  onKeyDownCapture={unlockCredentials}
                  onFocus={unlockCredentials}
                  disabled={loading}
                  required
                />
              </label>

              <button className={styles.loginButton} type="submit" disabled={loading}>
                <span>{loading ? '登录中…' : '登录'}</span>
              </button>
            </div>

            <div className={styles.accountActions} aria-label="账号帮助">
              <button className={styles.accountAction} type="button">
                注册账号
              </button>
              <button className={styles.accountAction} type="button">
                忘记密码？
              </button>
            </div>

          </div>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
