'use client';
import { ChefHat } from 'lucide-react';
import { PageHeader, Empty } from '@/components/ui';

export default function Recetas() {
  return (
    <div>
      <PageHeader title="Recetas Royal" subtitle="Recetas para tus demostraciones y clientes" />
      <Empty icon={<ChefHat size={30} />} title="Próximamente" text="Acá vas a encontrar recetas paso a paso para cocinar con los productos Royal Prestige®." />
    </div>
  );
}
