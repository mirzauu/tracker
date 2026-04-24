'use client';

import { useState, useRef, useEffect } from 'react';
import { requestOtp, verifyOtp } from './actions';
import s from './login.module.css';
import Link from 'next/link';

export default function LoginPage() {
  const [stage, setStage] = useState<'login' | 'verify'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Login State
  const [email, setEmail] = useState('');

  // OTP State
  const [otp, setOtp] = useState(['', '', '', '']);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref4 = useRef<HTMLInputElement>(null);
  const inputRefs = [ref1, ref2, ref3, ref4];

  const isEmailValid = email.includes('@') && email.length > 3;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append('email', email);

    // Using the same requestOtp for both login and signup as it just sends the code
    const result = await requestOtp(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setMessage(result.success || '');
      setStage('verify');
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otp.join('');
    if (code.length < 4) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('code', code);
    // Send client timezone to the server for analytics
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);

    const result = await verifyOtp(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const val = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  useEffect(() => {
    if (stage === 'verify') {
      inputRefs[0].current?.focus();
    }
  }, [stage]);

  const allOtpFilled = otp.every(d => d.length === 1);

  return (
    <div className={s.layoutWrapper}>
      <div className={s.authCard}>
        {stage === 'login' ? (
          <>
            <div className={s.illustrationPanel}>
              <img src="/signup_img.png" alt="Login Illustration" className={s.illustration} />
            </div>

            <div className={s.formPanel}>
              <div className={s.headerRow}>
                <button className={s.iconBtn} onClick={() => window.history.back()}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </button>
                <h1 className={s.title}>Sign in</h1>
              </div>

              <form onSubmit={handleLogin} className={s.formContainer}>
                <div className={s.inputGroup}>
                  <label>Email</label>
                  <div className={`${s.inputWrapper} ${email.length > 0 ? s.inputWrapperActive : ''}`}>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    {isEmailValid && (
                      <div className={s.checkIcon}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <div className={s.formSpacer}></div>

                {error && <div className={s.errorText}>{error}</div>}

                <button type="submit" disabled={loading} className={s.primaryBtn}>
                  {loading ? <span className={s.spinner}></span> : 'Sign in'}
                </button>

                <div className={s.bottomLink}>
                  New here? <Link href="/signup">Create account</Link>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            <div className={s.illustrationPanel}>
              <img src="/verify_img.png" alt="Verify Illustration" className={s.illustration} />
            </div>

            <div className={s.formPanel}>
              <div className={s.headerRow}>
                <button className={s.iconBtn} onClick={() => setStage('login')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </button>
                <h1 className={s.title}>Verify email</h1>
              </div>

              <div className={s.verifyContainer}>
                <p className={s.subtitle}>
                  An email with a verification code has been sent to your email
                </p>

                <div className={s.otpContainer}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={inputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className={`${s.otpInput} ${digit !== '' ? s.otpInputFilled : ''}`}
                    />
                  ))}
                </div>

                <div className={s.resendLinks}>
                  <p>Didn't receive a code? <button type="button" onClick={handleLogin} className={s.linkBtn}>Request again</button></p>
                  <button type="button" className={`${s.linkBtn} ${s.linkBtnMt}`}>Get via call</button>
                </div>

                {error && <div className={s.errorText}>{error}</div>}

                <button
                  onClick={handleVerifySubmit}
                  disabled={!allOtpFilled || loading}
                  className={`${s.primaryBtn} ${s.verifyBtn} ${allOtpFilled ? s.verifyBtnReady : ''}`}
                >
                  {loading ? <span className={s.spinner}></span> : 'Verify email'}
                </button>

                <div className={s.bottomLink}>
                  New here? <Link href="/signup">Create account instead</Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
