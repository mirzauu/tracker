'use client';

import { useState } from 'react';
import { requestOtp, verifyOtp } from './actions';

export default function LoginPage() {
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await requestOtp(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setMessage(result.success || '');
      setEmail(result.email || '');
      setStage('otp');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append('email', email); // Ensure email is sent
    const result = await verifyOtp(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // Success redirects in action
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon">✨</div>
          <h1>{stage === 'email' ? 'Welcome to Tracker' : 'Verify Email'}</h1>
          <p>
            {stage === 'email' 
              ? 'Enter your email to receive a sign-in code' 
              : `We sent a code to ${email}`}
          </p>
        </div>

        {stage === 'email' ? (
          <form onSubmit={handleRequestOtp} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="name@example.com" 
                required 
                className="form-input"
              />
            </div>

            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? <span className="spinner"></span> : 'Send Sign-in Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="login-form">
            <div className="form-group">
              <label htmlFor="code">Verification Code</label>
              <input 
                id="code" 
                name="code" 
                type="text" 
                maxLength={6}
                placeholder="000000" 
                required 
                className="form-input otp-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name (Optional)</label>
              <input 
                id="fullName" 
                name="fullName" 
                type="text" 
                placeholder="Your name" 
                className="form-input"
              />
              <p className="input-hint">Will be used if this is your first time signing in.</p>
            </div>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? <span className="spinner"></span> : 'Verify & Sign In'}
            </button>

            <button 
              type="button" 
              onClick={() => setStage('email')} 
              className="back-btn"
            >
              Back to Email
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at top right, #f8fafc, #eff6ff);
          padding: 20px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .login-card {
          background: white;
          padding: 40px;
          border-radius: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
          width: 100%;
          max-width: 440px;
          text-align: center;
          border: 1px solid rgba(226, 232, 240, 0.8);
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .logo-icon {
          font-size: 40px;
          margin-bottom: 20px;
          display: inline-block;
        }

        h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 8px;
          letter-spacing: -0.025em;
        }

        p {
          color: #64748b;
          font-size: 15px;
          margin-bottom: 32px;
        }

        .login-form {
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }

        .form-input {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          font-size: 15px;
          transition: all 0.2s;
          background: #f8fafc;
        }

        .otp-input {
          text-align: center;
          font-size: 24px;
          letter-spacing: 8px;
          font-weight: 700;
          color: #3b82f6;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .input-hint {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 8px;
        }

        .submit-btn:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .back-btn {
          background: none;
          border: none;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 8px;
          text-decoration: underline;
        }

        .back-btn:hover {
          color: #334155;
        }

        .error-message {
          color: #ef4444;
          font-size: 14px;
          background: #fef2f2;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #fee2e2;
        }

        .success-message {
          color: #10b981;
          font-size: 14px;
          background: #f0fdf4;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #d1fae5;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
