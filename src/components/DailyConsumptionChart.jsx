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

  // 🧠 Filtrage des données
  const filteredData = useMemo(() => {
    return data
      .filter(({ date }) => {
        const d = dayjs(date);
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
        Montant,
        Rembourse: +(Montant * 0.8).toFixed(2)
      }));
  }, [data, filterType, selectedYear, selectedMonth, startDate, endDate]);

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
          <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="rembourseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f9d423" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={str => str.slice(5)} />
            <YAxis />
            <Tooltip formatter={value => `${value} MAD`} />
            <Legend />
            <Bar dataKey="Montant" name="Montant total (MAD)" fill="#3b82f6" barSize={30} />
            <Bar dataKey="Rembourse" name="Montant remboursé (80%)" fill="url(#rembourseGradient)" barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
