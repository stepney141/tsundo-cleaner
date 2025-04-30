import React, { useState } from 'react';
import styled from 'styled-components';
import { Book, BookType } from '../types/Book';
import { bookService } from '../services/bookService';
import BookCard from '../components/BookCard';
import SimilarBooks from '../components/SimilarBooks';
import Layout from '../components/Layout';

/**
 * 検索ページコンポーネント - 書籍検索と類似書籍表示
 */
const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bookType, setBookType] = useState<BookType>('stacked');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('検索語を入力してください');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSelectedBook(null);
      
      const results = await bookService.searchBooks(searchQuery, bookType);
      setSearchResults(results);
      
      if (results.length === 0) {
        setError('検索結果が見つかりませんでした');
      }
    } catch (err) {
      console.error('書籍検索エラー:', err);
      setError('検索中にエラーが発生しました。後ほど再度お試しください。');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
  };

  return (
    <Layout>
      <PageContainer>
        <PageTitle>書籍検索</PageTitle>
        <Description>
          読みたい本・積読本の中から書籍を検索し、類似した本を探すことができます。
        </Description>

        <SearchForm onSubmit={handleSearch}>
          <SearchInput
            type="text"
            placeholder="タイトル、著者、出版社などで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <TypeSelector>
            <TypeOption>
              <input
                type="radio"
                id="stacked"
                name="bookType"
                checked={bookType === 'stacked'}
                onChange={() => setBookType('stacked')}
              />
              <label htmlFor="stacked">積読本</label>
            </TypeOption>

            <TypeOption>
              <input
                type="radio"
                id="wish"
                name="bookType"
                checked={bookType === 'wish'}
                onChange={() => setBookType('wish')}
              />
              <label htmlFor="wish">読みたい本</label>
            </TypeOption>
          </TypeSelector>
          
          <SearchButton type="submit" disabled={loading}>
            {loading ? '検索中...' : '検索'}
          </SearchButton>
        </SearchForm>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <ResultsContainer>
          {searchResults.length > 0 && (
            <div>
              <SectionTitle>検索結果 ({searchResults.length}件)</SectionTitle>
              <SearchResultsList>
                {searchResults.map((book) => (
                  <div key={book.bookmeter_url} onClick={() => handleBookSelect(book)}>
                    <BookCard book={book} bookType={book.bookType || bookType} />
                  </div>
                ))}
              </SearchResultsList>
            </div>
          )}

          {selectedBook && (
            <SimilarBooksSection>
              <SimilarBooks bookUrl={selectedBook.bookmeter_url} type={bookType} limit={5} />
            </SimilarBooksSection>
          )}
        </ResultsContainer>
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

const SearchForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
  background-color: #f8f9fa;
  padding: 24px;
  border-radius: 8px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 16px;

  &:focus {
    outline: none;
    border-color: #4a6da7;
    box-shadow: 0 0 0 2px rgba(74, 109, 167, 0.2);
  }
`;

const TypeSelector = styled.div`
  display: flex;
  gap: 16px;
`;

const TypeOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SearchButton = styled.button`
  padding: 12px 24px;
  background-color: #4a6da7;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #3a5a8f;
  }

  &:disabled {
    background-color: #adb5bd;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  padding: 16px;
  background-color: #fff3f3;
  border-radius: 8px;
  color: #d32f2f;
  border: 1px solid #ffcdd2;
  margin-bottom: 24px;
`;

const ResultsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
`;

const SectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
`;

const SearchResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SimilarBooksSection = styled.div`
  margin-top: 32px;
`;

export default SearchPage;
