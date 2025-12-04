import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
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
            window.location.href = '/';
          }
        } catch (error) {
          console.error('Auth callback error:', error);
          // Redirect về trang login nếu có lỗi
          if (!isCancelled) {
            window.location.href = '/login';
          }
        }
      }
    };

    handleAuthCallback();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-gray-600">Please wait while we complete the authentication process.</p>
      </div>
    </div>
  );
} 