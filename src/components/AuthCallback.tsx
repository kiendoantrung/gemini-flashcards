import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let isCancelled = false;

    // Xử lý hash fragment từ URL
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');

      if (accessToken) {
        try {
          // Cập nhật session trong Supabase
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) throw error;

          if (session && !isCancelled) {
            // Redirect về trang chính sau khi xác thực thành công
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error('Auth callback error:', error);
          // Redirect về trang login nếu có lỗi
          if (!isCancelled) {
            navigate('/login', { replace: true });
          }
        }
      }
    };

    handleAuthCallback();

    return () => {
      isCancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-gray-600">Please wait while we complete the authentication process.</p>
      </div>
    </div>
  );
} 