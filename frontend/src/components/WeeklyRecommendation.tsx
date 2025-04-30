import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Book } from '../types/Book';
import { bookService } from '../services/bookService';
import BookCard from './BookCard';

/**
 * 週間おすすめ本を表示するコンポーネント
 */
const WeeklyRecommendation: React.FC = () => {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeeklyBook = async () => {
      try {
        setLoading(true);
        const weeklyBook = await bookService.getWeeklyRecommendation();
        setBook(weeklyBook);
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

  if (loading) {
    return <LoadingContainer>読み込み中...</LoadingContainer>;
  }

  if (error) {
    return <ErrorContainer>{error}</ErrorContainer>;
  }

  if (!book) {
    return <EmptyContainer>おすすめの本が見つかりませんでした。</EmptyContainer>;
  }

  return (
    <Container>
      <SectionTitle>今週の読書推薦</SectionTitle>
      <WeeklyBookContainer>
        <BookCard book={book} bookType={book.bookType || 'wish'} />
        <LibraryLinks>
          {book.sophia_opac && (
            <LibraryLink href={book.sophia_opac} target="_blank" rel="noopener noreferrer">
              上智大学OPACで見る
            </LibraryLink>
          )}
          {book.utokyo_opac && (
            <LibraryLink href={book.utokyo_opac} target="_blank" rel="noopener noreferrer">
              東京大学OPACで見る
            </LibraryLink>
          )}
          {book.bookmeter_url && (
            <LibraryLink href={book.bookmeter_url} target="_blank" rel="noopener noreferrer">
              読書メーターで見る
            </LibraryLink>
          )}
        </LibraryLinks>
      </WeeklyBookContainer>
    </Container>
  );
};

const Container = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
`;

const WeeklyBookContainer = styled.div`
  border-radius: 8px;
  background-color: #f8f9fa;
  padding: 16px;
`;

const LibraryLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 16px;
`;

const LibraryLink = styled.a`
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background-color: #4a6da7;
  color: white;
  border-radius: 4px;
  text-decoration: none;
  font-size: 14px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #3a5a8f;
  }
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

const EmptyContainer = styled.div`
  padding: 32px;
  text-align: center;
  color: #666;
  background-color: #f5f5f5;
  border-radius: 8px;
`;

export default WeeklyRecommendation;
