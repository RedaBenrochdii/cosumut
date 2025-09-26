// src/components/DailyConsumptionChart.jsx
import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import dayjs from 'dayjs';

export default function DailyConsumptionChart({ data }) {
  const [filterType, setFilterType] = useState('all');
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 🧠 Filtrage des données avec TRI CHRONOLOGIQUE
  const filteredData = useMemo(() => {
    console.log('Données brutes reçues:', data); // 🔍 Debug

    return data
      .filter(({ date, Montant }) => {
        // 🔧 AJOUT: Filtrer les montants valides
        const montantNum = parseFloat(Montant);
        if (!date || isNaN(montantNum) || montantNum <= 0) {
          return false;
        }

        const d = dayjs(date);
        if (!d.isValid()) return false;

        if (filterType === 'month') {
          return d.year() === +selectedYear && d.month() + 1 === +selectedMonth;
        }
        if (filterType === 'year') {
          return d.year() === +selectedYear;
        }
        if (filterType === 'range') {
          return (!startDate || d.isAfter(dayjs(startDate).subtract(1, 'day'))) &&
                 (!endDate || d.isBefore(dayjs(endDate).add(1, 'day')));
        }
        return true;
      })
      .map(({ date, Montant }) => ({
        date,
        Montant: parseFloat(Montant), // 🔧 CORRECTION: Assurer que c'est un nombre
        Rembourse: +(parseFloat(Montant) * 0.8).toFixed(2)
      }))
      // 🔧 AJOUT CRUCIAL: TRI CHRONOLOGIQUE
      .sort((a, b) => {
        const dateA = dayjs(a.date);
        const dateB = dayjs(b.date);
        return dateA.isBefore(dateB) ? -1 : dateA.isAfter(dateB) ? 1 : 0;
      });
  }, [data, filterType, selectedYear, selectedMonth, startDate, endDate]);

  // 🔍 Debug pour voir les données filtrées et triées
  console.log('Données filtrées et triées:', filteredData);

  // 🛠️ Fonction de formatage de la date en "JJ/MM"
  const formatDate = (dateString) => {
    const date = dayjs(dateString);
    if (!date.isValid()) {
      return '';
    }
    // Formatte en "JJ/MM" (e.g., 30/08)
    return date.format('DD/MM');
  };

  // 🛠️ Fonction de formatage de la date en "JJ/MM/AAAA" pour le tooltip
  const formatTooltipLabel = (dateString) => {
    const date = dayjs(dateString);
    if (!date.isValid()) {
      return '';
    }
    return date.format('DD/MM/YYYY');
  };

  return (
    <div style={{ width: '100%' }}>
      {/* 🎛️ Filtres */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>Filtrer par : </label>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">Tous</option>
          <option value="year">Année</option>
          <option value="month">Mois</option>
          <option value="range">Intervalle</option>
        </select>

        {(filterType === 'year' || filterType === 'month') && (
          <input
            type="number"
            placeholder="Année"
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            min="2000"
            max="2100"
          />
        )}

        {filterType === 'month' && (
          <input
            type="number"
            placeholder="Mois (1-12)"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            min="1"
            max="12"
          />
        )}

        {filterType === 'range' && (
          <>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span>au</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </>
        )}
      </div>

      

      {/* 📊 Graphique */}
      <div style={{ height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="rembourseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f9d423" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            
            {/* ✅ Axe X : affiche "JJ/MM" */}
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            
            {/* 🔧 CORRECTION: Axe Y avec formatage des montants */}
            <YAxis />
            
            {/* ✅ Tooltip avec format complet */}
            <Tooltip 
              formatter={(value, name) => [`${parseFloat(value).toLocaleString()} MAD`, name]} 
              labelFormatter={formatTooltipLabel}
            />
            
            <Legend />
            <Bar dataKey="Montant" name="Montant total (MAD)" fill="#3b82f6" barSize={30} />
            <Bar dataKey="Rembourse" name="Montant remboursé " fill="url(#rembourseGradient)" barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
