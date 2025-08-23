
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
// Globe icon removed as language toggle is no longer needed

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Language toggle removed - English only

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">NY</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">NY FASHION</h1>
          <p className="text-gray-600 mt-2">{t('welcome')}</p>
        </div>

        <Card className="rounded-3xl border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('login')}</CardTitle>
            <CardDescription>{t('signIn')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl"
                  required />

              </div>
              <div>
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl"
                  required />

              </div>
              <Button
                type="submit"
                className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading}>

                {isLoading ? t('loading') : t('signIn')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-emerald-600 hover:text-emerald-700 font-medium">
                  {t('register')}
                </Link>
              </p>
            </div>

            {/* Language toggle removed - application now supports English only */}

            <div className="mt-6 text-xs text-gray-500 text-center">
              <p>Demo Credentials:</p>
              <p>Admin: admin@nyfashion.com</p>
              <p>Manager: manager@nyfashion.com</p>
              <p>Employee: employee@nyfashion.com</p>
              <p>Password: any password</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);

};

export default LoginPage;