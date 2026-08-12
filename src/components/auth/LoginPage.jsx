import { useState } from 'react';
import brandMark from '../../assets/login/hero-mark.png';
import brandTagline from '../../assets/login/born-for-passion.png';
import styles from './LoginPage.module.less';

// 登录页只负责收集凭据，实际鉴权仍交由应用层处理。
function LoginPage({ onLogin, loading = false }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

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
          autoComplete="off"
          aria-busy={loading}
          data-form-type="other"
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
                  id="login-account"
                  type="text"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="用户名"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-lpignore="true"
                  disabled={loading}
                  required
                />
              </span>
            </label>

            <label className={styles.fieldLabel} htmlFor="login-password">
              密码
              <span className={styles.inputShell}>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="密码"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-lpignore="true"
                  disabled={loading}
                  required
                />
              </span>
            </label>

            <div className={styles.accountActions} aria-label="账号帮助">
              <button className={styles.accountAction} type="button">
                注册账号
              </button>
              <button className={styles.accountAction} type="button">
                忘记密码？
              </button>
            </div>

            <button className={styles.loginButton} type="submit" disabled={loading}>
              <span>{loading ? '登录中…' : '登录'}</span>
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
