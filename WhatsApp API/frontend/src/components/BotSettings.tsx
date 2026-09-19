import React, { useState, useEffect } from 'react';
import type { Company, WhatsAppSettings } from '../types/index.js';
import { api } from '../services/api.js';
import { Switch } from './ui/Switch.js';
import { Save, CheckCircle2, Clock, MessageSquare, ShieldAlert } from 'lucide-react';

interface BotSettingsProps {
  company: Company;
}

export const BotSettings: React.FC<BotSettingsProps> = ({ company }) => {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [company.id]);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings(company.id);
      setSettings(data);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      await api.updateSettings(company.id, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div style={{ padding: '60px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
        Carregando configurações...
      </div>
    );
  }

  const daysOfWeek = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-primary)',
        padding: '32px 40px',
      }}
    >
      <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* iOS Navigation Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Configurações do Bot
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Automação, mensagens e horários de atendimento para {company.name}.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ borderRadius: 'var(--radius-sm)', padding: '8px 18px', gap: '6px' }}
          >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? 'Salvo' : saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        {/* Section 1: Automação Switches (iOS Grouped Table) */}
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '12px', letterSpacing: '0.04em' }}>
            AUTOMAÇÃO & RESPOSTAS
          </div>
          <div className="ios-card" style={{ padding: '0 16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 0' }}>
              <Switch
                checked={settings.autoReplyEnabled}
                onChange={(checked) => setSettings({ ...settings, autoReplyEnabled: checked })}
                label="Atendimento Automático do Bot"
                description="O robô responde instantaneamente às mensagens recebidas no WhatsApp"
              />
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />

            <div style={{ padding: '14px 0' }}>
              <Switch
                checked={settings.humanSupportEnabled}
                onChange={(checked) => setSettings({ ...settings, humanSupportEnabled: checked })}
                label="Transbordo para Atendente Humano"
                description="Permite que o cliente peça para falar com a equipe ou seja transferido"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Mensagens Personalizadas */}
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '12px', letterSpacing: '0.04em' }}>
            MENSAGENS DO SISTEMA
          </div>
          <div className="ios-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Boas-vindas */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#FFFFFF', fontSize: '0.88rem', fontWeight: 500 }}>
                <MessageSquare size={15} color="var(--ios-blue)" />
                <span>Mensagem de Boas-vindas</span>
              </div>
              <textarea
                value={settings.welcomeMessage || ''}
                onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                rows={3}
                placeholder="Mensagem enviada quando um novo cliente inicia contato..."
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  padding: '10px 14px',
                  lineHeight: '1.45',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />

            {/* Fallback */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#FFFFFF', fontSize: '0.88rem', fontWeight: 500 }}>
                <ShieldAlert size={15} color="var(--ios-orange)" />
                <span>Mensagem de Fallback (Não compreendido)</span>
              </div>
              <textarea
                value={settings.fallbackMessage || ''}
                onChange={(e) => setSettings({ ...settings, fallbackMessage: e.target.value })}
                rows={2}
                placeholder="Mensagem quando o bot não entende a opção digitada..."
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  padding: '10px 14px',
                  lineHeight: '1.45',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />

            {/* Fora do Horário */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#FFFFFF', fontSize: '0.88rem', fontWeight: 500 }}>
                <Clock size={15} color="var(--ios-purple)" />
                <span>Mensagem Fora do Horário de Atendimento</span>
              </div>
              <textarea
                value={settings.outOfHoursMessage || ''}
                onChange={(e) => setSettings({ ...settings, outOfHoursMessage: e.target.value })}
                rows={2}
                placeholder="Mensagem quando o cliente envia mensagem fora do horário..."
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  padding: '10px 14px',
                  lineHeight: '1.45',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Horários de Atendimento */}
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '12px', letterSpacing: '0.04em' }}>
            HORÁRIOS DE ATENDIMENTO
          </div>
          <div className="ios-card" style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column' }}>
            {daysOfWeek.map((day, idx) => {
              const schedule = (settings.workingHours as any)?.[day.key] || { enabled: true, start: '13:00', end: '22:00' };

              return (
                <React.Fragment key={day.key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={schedule.enabled}
                        onChange={(e) => {
                          const updated = {
                            ...settings.workingHours,
                            [day.key]: { ...schedule, enabled: e.target.checked },
                          };
                          setSettings({ ...settings, workingHours: updated });
                        }}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--ios-green)', cursor: 'pointer' }}
                      />
                      <span style={{ color: schedule.enabled ? '#FFFFFF' : 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: 500 }}>
                        {day.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="time"
                        value={schedule.start || '13:00'}
                        disabled={!schedule.enabled}
                        onChange={(e) => {
                          const updated = {
                            ...settings.workingHours,
                            [day.key]: { ...schedule, start: e.target.value },
                          };
                          setSettings({ ...settings, workingHours: updated });
                        }}
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--separator)',
                          borderRadius: '6px',
                          color: '#FFFFFF',
                          padding: '4px 8px',
                          fontSize: '0.82rem',
                          fontVariantNumeric: 'tabular-nums',
                          outline: 'none',
                          opacity: schedule.enabled ? 1 : 0.4,
                        }}
                      />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>até</span>
                      <input
                        type="time"
                        value={schedule.end || '22:00'}
                        disabled={!schedule.enabled}
                        onChange={(e) => {
                          const updated = {
                            ...settings.workingHours,
                            [day.key]: { ...schedule, end: e.target.value },
                          };
                          setSettings({ ...settings, workingHours: updated });
                        }}
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--separator)',
                          borderRadius: '6px',
                          color: '#FFFFFF',
                          padding: '4px 8px',
                          fontSize: '0.82rem',
                          fontVariantNumeric: 'tabular-nums',
                          outline: 'none',
                          opacity: schedule.enabled ? 1 : 0.4,
                        }}
                      />
                    </div>
                  </div>

                  {idx < daysOfWeek.length - 1 && (
                    <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
