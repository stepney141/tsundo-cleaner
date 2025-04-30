// API安定性テストスクリプト
// 並行リクエストを送信して404エラーの発生状況を検証する

const fetch = require('node-fetch');
const util = require('util');

// 設定
const API_ENDPOINT = 'http://localhost:3001/api/books/weekly';
const CONCURRENT_REQUESTS = 50;  // 同時リクエスト数
const DELAY_BETWEEN_BATCHES_MS = 100; // バッチ間の遅延（ミリ秒）
const TOTAL_BATCHES = 10; // 合計バッチ数

// 結果を格納する変数
const results = {
  success: 0,
  notFound: 0,
  otherErrors: 0,
  responses: []
};

// 単一のAPIリクエストを実行する関数
async function makeRequest(id) {
  try {
    console.log(`リクエスト #${id} 送信中...`);
    const startTime = Date.now();
    const response = await fetch(API_ENDPOINT);
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (response.ok) {
      const data = await response.json();
      results.success++;
      results.responses.push({
        id,
        status: response.status,
        duration,
        success: true,
        data: data
      });
      console.log(`リクエスト #${id} 成功 (${duration}ms)`);
      return { success: true, status: response.status };
    } else if (response.status === 404) {
      const errorData = await response.json();
      results.notFound++;
      results.responses.push({
        id,
        status: response.status,
        duration,
        success: false,
        error: errorData
      });
      console.log(`リクエスト #${id} 404エラー (${duration}ms)`);
      return { success: false, status: response.status, error: 'Not Found' };
    } else {
      const errorData = await response.json();
      results.otherErrors++;
      results.responses.push({
        id,
        status: response.status,
        duration,
        success: false,
        error: errorData
      });
      console.log(`リクエスト #${id} エラー: ${response.status} (${duration}ms)`);
      return { success: false, status: response.status, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    results.otherErrors++;
    results.responses.push({
      id,
      success: false,
      error: error.message
    });
    console.error(`リクエスト #${id} 例外:`, error.message);
    return { success: false, error: error.message };
  }
}

// 複数のリクエストを同時に実行する関数
async function runConcurrentRequests(batchNumber, count) {
  console.log(`\nバッチ ${batchNumber}/${TOTAL_BATCHES}: ${count}個の同時リクエストを実行します...`);
  const startTime = Date.now();
  
  const requests = Array(count).fill().map((_, i) => 
    makeRequest(`${batchNumber}-${i + 1}`)
  );
  
  await Promise.all(requests);
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  console.log(`バッチ ${batchNumber} 完了: ${totalDuration}ms`);
}

// メイン実行関数
async function runTest() {
  console.log(`API安定性テスト開始: ${API_ENDPOINT}`);
  console.log(`合計 ${TOTAL_BATCHES} バッチ、各バッチ ${CONCURRENT_REQUESTS} 同時リクエスト`);
  
  const startTime = Date.now();
  
  for (let batch = 1; batch <= TOTAL_BATCHES; batch++) {
    await runConcurrentRequests(batch, CONCURRENT_REQUESTS);
    
    // バッチ間で少し待機
    if (batch < TOTAL_BATCHES) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // 結果を表示
  console.log('\n========== テスト結果 ==========');
  console.log(`合計リクエスト数: ${TOTAL_BATCHES * CONCURRENT_REQUESTS}`);
  console.log(`成功: ${results.success} (${(results.success / (TOTAL_BATCHES * CONCURRENT_REQUESTS) * 100).toFixed(2)}%)`);
  console.log(`404エラー: ${results.notFound} (${(results.notFound / (TOTAL_BATCHES * CONCURRENT_REQUESTS) * 100).toFixed(2)}%)`);
  console.log(`その他のエラー: ${results.otherErrors} (${(results.otherErrors / (TOTAL_BATCHES * CONCURRENT_REQUESTS) * 100).toFixed(2)}%)`);
  console.log(`合計実行時間: ${totalDuration}ms`);
  
  // エラーパターンの分析
  if (results.notFound > 0) {
    console.log('\n404エラーパターンの分析:');
    
    // エラーが発生したリクエストのみを取得
    const notFoundResponses = results.responses.filter(r => r.status === 404);
    
    // リクエストの時系列分布を表示
    console.log('時系列404エラー発生分布:');
    const timelineGroups = {};
    
    notFoundResponses.forEach(r => {
      const batchId = r.id.split('-')[0];
      timelineGroups[batchId] = (timelineGroups[batchId] || 0) + 1;
    });
    
    Object.keys(timelineGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(batchId => {
      console.log(`  バッチ ${batchId}: ${timelineGroups[batchId]}件の404エラー`);
    });
    
    // 直前・直後の成功レスポンスとの比較
    console.log('\n同一バッチ内の成功/失敗パターン:');
    for (let batch = 1; batch <= TOTAL_BATCHES; batch++) {
      const batchResponses = results.responses.filter(r => r.id.startsWith(`${batch}-`));
      const successCount = batchResponses.filter(r => r.success).length;
      const failCount = batchResponses.filter(r => !r.success).length;
      
      if (failCount > 0) {
        console.log(`  バッチ ${batch}: 成功=${successCount}, 失敗=${failCount}`);
      }
    }
  }
  
  // 詳細なデバッグ情報（オプション）
  if (process.env.DEBUG) {
    console.log('\n詳細なレスポンス情報:');
    console.log(util.inspect(results.responses.slice(0, 10), { depth: 3, colors: true }));
    
    if (results.responses.length > 10) {
      console.log(`... 他 ${results.responses.length - 10} 件のレスポンス`);
    }
  }
}

// テスト実行
runTest().catch(err => {
  console.error('テスト実行中にエラーが発生しました:', err);
  process.exit(1);
});
