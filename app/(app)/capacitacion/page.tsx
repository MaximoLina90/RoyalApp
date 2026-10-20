'use client';
import { GraduationCap } from 'lucide-react';
import { PageHeader, Empty } from '@/components/ui';

export default function Capacitacion() {
  return (
    <div>
      <PageHeader title="Capacitación" subtitle="Material de formación para el equipo" />
      <Empty icon={<GraduationCap size={30} />} title="Próximamente" text="Acá vas a encontrar videos, guías y material de capacitación para vendedores." />
    </div>
  );
}
