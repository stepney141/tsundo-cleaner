import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Book } from '../types/Book';
import { bookService } from '../services/bookService';
import WeeklyRecommendation from '../components/WeeklyRecommendation';
import SimilarBooks from '../components/SimilarBooks';
import Layout from '../components/Layout';

/**
 * ホームページコンポーネント - 週間おすすめ本と類似書籍を表示
 */
const HomePage: React.FC = () => {
  const [weeklyBook, setWeeklyBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeeklyBook = async () => {
      try {
        setLoading(true);
        const book = await bookService.getWeeklyRecommendation();
        setWeeklyBook(book);
        setError(null);
      } catch (err) {
        console.error('週間おすすめ本の取得に失敗しました', err);
        setError('週間おすすめ本の取得に失敗しました。後ほど再度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyBook();
  }, []);

  return (
    <Layout>
      <PageContainer>
        <PageTitle>今週はこの本を読もう</PageTitle>
        <Description>
          積読本・読みたい本の中からおすすめの一冊を毎週提案します。
        </Description>

        <WeeklyRecommendation />

        {!loading && !error && weeklyBook && (
          <SimilarBooksSection>
            <SimilarBooks 
              bookUrl={weeklyBook.bookmeter_url} 
              type={weeklyBook.bookType} 
              limit={5} 
            />
          </SimilarBooksSection>
        )}
      </PageContainer>
    </Layout>
  );
};

const PageContainer = styled.div`
  max-width: 800px;
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

const SimilarBooksSection = styled.div`
  margin-top: 48px;
`;

export default HomePage;
