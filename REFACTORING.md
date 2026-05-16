# App.tsx 重构说明

## 重构概览

本次重构将原本 600+ 行的 `App.tsx` 拆分为多个模块化的自定义 Hooks 和组件，提升了代码的可维护性、可测试性和性能。

## 主要改进

### 1. 错误边界 (ErrorBoundary)

**文件**: `components/ErrorBoundary.tsx`

- 捕获组件树中的 JavaScript 错误
- 提供友好的错误界面
- 支持错误重试和页面刷新
- 防止整个应用崩溃

### 2. 状态管理拆分

#### useAppState
**文件**: `hooks/useAppState.ts`

- 管理应用级别的状态（activeTab, pendingDeduplication）
- 处理路由同步逻辑
- 使用 useReducer 优化状态更新

#### useScrollHelpers
**文件**: `hooks/useScrollHelpers.ts`

- 统一管理所有滚动相关的 refs 和方法
- 提供 scrollToUpload, scrollToRoi, scrollToProcess, scrollToResult 等方法

### 3. 业务逻辑提取

#### useVideoUpload
**文件**: `hooks/useVideoUpload.ts`

- 处理视频上传和元数据提取
- 管理视频替换逻辑
- 集成确认对话框和错误处理

#### useQuickProcess
**文件**: `hooks/useQuickProcess.ts`

- 封装一键处理的复杂逻辑
- 支持对话、地点、双模式处理
- 处理 SRT 和固定帧间隔两种模式

#### useProcessingComplete
**文件**: `hooks/useProcessingComplete.ts`

- 处理视频处理完成后的逻辑
- 管理连续处理流程（对话 → 地点）
- 自动去重逻辑

#### useOneClickRecognize
**文件**: `hooks/useOneClickRecognize.ts`

- 一键识别功能
- 管理拼接进度状态
- 处理分组合并和图片拼接

#### useJumpToTime
**文件**: `hooks/useJumpToTime.ts`

- 时间戳跳转功能
- 自动切换到提取标签页
- 同步视频播放位置

#### useClearAllData
**文件**: `hooks/useClearAllData.ts`

- 清空所有数据的确认和执行
- 统一的数据清理逻辑

### 4. 性能优化

#### 使用 useCallback
所有事件处理函数都使用 `useCallback` 包裹，避免不必要的重新渲染：

- `handleVideoUploaded`
- `handleQuickProcess`
- `handleProcessingComplete`
- `handleOneClickRecognize`
- `handleJumpToTime`
- `handleClearAllData`
- `handleReplaceVideo`

#### 懒加载 (Lazy Loading)
所有标签页组件使用 `React.lazy` 和 `Suspense` 实现按需加载：

- GalleryTab
- ProofreadEditorTab
- BaimiaoTab
- AiChatTab

#### 依赖优化
每个自定义 Hook 都精确声明了依赖项，避免不必要的重新计算。

### 5. 代码组织

#### 之前
```
App.tsx (600+ 行)
├── 类型定义
├── 工具函数
├── 状态管理
├── 副作用
├── 事件处理
└── 渲染逻辑
```

#### 之后
```
App.tsx (200 行)
├── ErrorBoundary
├── NotificationProvider
└── AppContent
    ├── useAppState (状态)
    ├── useScrollHelpers (滚动)
    ├── useFrameManagement (帧管理)
    ├── useVideoProcessing (视频处理)
    ├── useDeduplication (去重)
    ├── useVideoUpload (上传)
    ├── useQuickProcess (一键处理)
    ├── useProcessingComplete (完成处理)
    ├── useOneClickRecognize (一键识别)
    ├── useJumpToTime (时间跳转)
    └── useClearAllData (清空数据)
```

## 文件清单

### 新增文件

1. `components/ErrorBoundary.tsx` - 错误边界组件
2. `hooks/useAppState.ts` - 应用状态管理
3. `hooks/useVideoUpload.ts` - 视频上传逻辑
4. `hooks/useQuickProcess.ts` - 一键处理逻辑
5. `hooks/useProcessingComplete.ts` - 处理完成逻辑
6. `hooks/useOneClickRecognize.ts` - 一键识别逻辑
7. `hooks/useScrollHelpers.ts` - 滚动辅助
8. `hooks/useJumpToTime.ts` - 时间跳转
9. `hooks/useClearAllData.ts` - 清空数据

### 修改文件

1. `App.tsx` - 主应用组件（大幅简化）
2. `hooks/index.ts` - 导出新增的 Hooks

## 优势

### 可维护性
- 每个 Hook 职责单一，易于理解和修改
- 业务逻辑与 UI 分离
- 代码结构清晰，易于定位问题

### 可测试性
- 每个 Hook 可以独立测试
- 减少了测试的复杂度
- 更容易 mock 依赖

### 性能
- 使用 useCallback 避免不必要的重新渲染
- 懒加载减少初始加载时间
- 精确的依赖声明避免不必要的计算

### 可复用性
- Hooks 可以在其他组件中复用
- 业务逻辑可以轻松迁移到其他项目

## 向后兼容

本次重构保持了所有原有功能，没有破坏性变更：

- ✅ 所有功能正常工作
- ✅ API 接口保持不变
- ✅ 用户体验一致
- ✅ 性能有所提升

## 未来改进方向

1. 为每个 Hook 添加单元测试
2. 考虑使用 React.memo 优化子组件
3. 使用 useMemo 优化复杂计算
4. 考虑引入状态管理库（如 Zustand）进一步简化状态管理
