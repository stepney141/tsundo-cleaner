import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { BookType, PublisherDistribution, AuthorDistribution, YearDistribution, LibraryDistribution } from '../types/Book';
import { statisticsService } from '../services/statisticsService';
import Layout from '../components/Layout';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

/**
 * 読書傾向の統計情報を表示するページコンポーネント
 */
const StatsPage: React.FC = () => {
  const [bookType, setBookType] = useState<BookType>('wish');
  const [publishers, setPublishers] = useState<PublisherDistribution[]>([]);
  const [authors, setAuthors] = useState<AuthorDistribution[]>([]);
  const [years, setYears] = useState<YearDistribution[]>([]);
  const [libraries, setLibraries] = useState<LibraryDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        setError(null);

        // 並行して統計データを取得
        const [
          publisherData,
          authorData,
          yearData,
          libraryData
        ] = await Promise.all([
          statisticsService.getPublisherDistribution(bookType),
          statisticsService.getAuthorDistribution(bookType),
          statisticsService.getYearDistribution(bookType),
          statisticsService.getLibraryDistribution(bookType)
        ]);

        setPublishers(publisherData.slice(0, 10)); // 上位10社
        setAuthors(authorData);
        
        // 年代を新しい順にソート
        const sortedYears = [...yearData].sort((a, b) => {
          const aYear = parseInt(a.year) || 0;
          const bYear = parseInt(b.year) || 0;
          return bYear - aYear;
        });
        setYears(sortedYears.slice(0, 15)); // 直近15年
        
        setLibraries(libraryData);
      } catch (err) {
        console.error('統計データの取得に失敗しました', err);
        setError('統計データの取得に失敗しました。後ほど再度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [bookType]);

  return (
    <Layout>
      <PageContainer>
        <PageTitle>読書傾向分析</PageTitle>
        <Description>
          読みたい本・積読本のデータを分析し、あなたの読書傾向を可視化します。
        </Description>

        <TypeSelector>
          <TypeOption>
            <input
              type="radio"
              id="wish-stats"
              name="bookTypeStats"
              checked={bookType === 'wish'}
              onChange={() => setBookType('wish')}
            />
            <label htmlFor="wish-stats">読みたい本</label>
          </TypeOption>
          
          <TypeOption>
            <input
              type="radio"
              id="stacked-stats"
              name="bookTypeStats"
              checked={bookType === 'stacked'}
              onChange={() => setBookType('stacked')}
            />
            <label htmlFor="stacked-stats">積読本</label>
          </TypeOption>
        </TypeSelector>

        {loading ? (
          <LoadingContainer>読み込み中...</LoadingContainer>
        ) : error ? (
          <ErrorContainer>{error}</ErrorContainer>
        ) : (
          <ChartsContainer>
            {/* 図書館所蔵状況 */}
            <ChartSection>
              <SectionTitle>図書館所蔵状況</SectionTitle>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={libraries}
                    dataKey="count"
                    nameKey="library"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    label={({ library, percent }) => `${library} ${(percent * 100).toFixed(0)}%`}
                  >
                    {libraries.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartSection>

            {/* 出版社分布 */}
            <ChartSection>
              <SectionTitle>出版社分布 (上位10社)</SectionTitle>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={publishers}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="publisher" width={80} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="書籍数" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </ChartSection>

            {/* 著者分布 */}
            <ChartSection>
              <SectionTitle>著者分布 (上位10名)</SectionTitle>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={authors.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="author" width={80} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="書籍数" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </ChartSection>

            {/* 出版年分布 */}
            <ChartSection>
              <SectionTitle>出版年分布 (直近15年)</SectionTitle>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={years}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="書籍数" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </ChartSection>
          </ChartsContainer>
        )}
      </PageContainer>
    </Layout>
  );
};

const PageContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
`;

const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #333;
`;

const Description = styled.p`
  font-size: 16px;
  color: #666;
  margin-bottom: 32px;
  line-height: 1.5;
`;

const TypeSelector = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  background-color: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
`;

const TypeOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LoadingContainer = styled.div`
  padding: 32px;
  text-align: center;
  color: #666;
`;

const ErrorContainer = styled.div`
  padding: 16px;
  background-color: #fff3f3;
  border-radius: 8px;
  color: #d32f2f;
  border: 1px solid #ffcdd2;
`;

const ChartsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
`;

const ChartSection = styled.section`
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #333;
`;

export default StatsPage;
