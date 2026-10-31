import { Component } from 'react';
import type { ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="auth-shell"><section className="workspace-card" role="alert">
      <h1>No se pudo abrir esta pantalla</h1>
      <p>Vuelve a cargar la aplicación. No borres los datos del navegador: puede haber capturas pendientes de sincronizar.</p>
      <button className="primary" onClick={() => location.reload()}>Volver a cargar</button>
    </section></main>;
  }
}
