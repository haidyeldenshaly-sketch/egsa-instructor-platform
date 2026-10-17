import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
const Ctx = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, variant = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, variant }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), variant === 'danger' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'danger'), info: (m) => push(m, 'info') }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 2000, position: 'fixed' }} aria-live="polite">
        {items.map((i) => (
          <Toast key={i.id} bg={i.variant} onClose={() => setItems((x) => x.filter((y) => y.id !== i.id))} show>
            <Toast.Body className={i.variant === 'info' ? '' : 'text-white'} role={i.variant === 'danger' ? 'alert' : 'status'}>{i.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
