import { LoginForm } from './login-form';
import './login.css';

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <div className="login-radar" aria-hidden="true">
        <span className="login-radar-ring r1" />
        <span className="login-radar-ring r2" />
        <span className="login-radar-ring r3" />
        <span className="login-radar-ring r4" />
        <span className="login-blip b1" />
        <span className="login-blip b2" />
        <span className="login-blip b3" />
      </div>

      <div className="login-content">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            <span className="login-brand-dot" />
          </span>
          <h1>
            KONGRE
            <br />
            BEACON
          </h1>
          <p>Yetkili Paneli</p>
        </div>

        <div className="login-card">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
