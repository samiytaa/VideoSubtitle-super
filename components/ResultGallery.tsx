import React, { useState } from 'react';
import { Image as ImageIcon, Layers, X, ChevronLeft, ChevronRight, Trash2, Scissors, RefreshCw } from 'lucide-react';
import { ExtractedFrame, MergedImage } from '../types';
import { downloadAsZip } from '../utils/imageUtils';
import { useNotifier } from './Notifications';
import GalleryToolbar from './resultGallery/GalleryToolbar';
import PaginationToolbar from './resultGallery/PaginationToolbar';
import FrameCard from './resultGallery/FrameCard';
import MergedImageCard from './resultGallery/MergedImageCard';
import MergeGroupDialog from './resultGallery/MergeGroupDialog';
import ImageInfoPanel from './resultGallery/ImageInfoPanel';
import { ResultGalleryProps, ViewType, GroupFilter, ItemsPerRow } from './resultGallery/types';
import { DEFAULT_MERGE_BATCH_SIZE } from '../config/constants';
import { confirmDelete } from '../utils/confirmActions';
import { useFrameFilter, useGalleryPagination } from '../hooks';

const GALLERY_STORAGE_KEYS = {
  viewType: 'resultGallery_viewType',
  itemsPerPageFrames: 'resultGallery_itemsPerPage_frames',
  itemsPerPageMerged: 'resultGallery_itemsPerPage_merged',
  itemsPerRowFrames: 'resultGallery_itemsPerRow_frames',
  itemsPerRowMerged: 'resultGallery_itemsPerRow_merged'
} as const;

const ResultGallery: React.FC<ResultGalleryProps> = ({
  frames,
  mergedImages,
  onMerge,
  onOneClickRecognize,
  onDelete,
  onDeleteMerged,
  onClearMerged,
  onClearAll,
  onImportFrames,
  onImportMerged,
  onMergeGroups,
  onJumpToTime,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rangeSelectMode, setRangeSelectMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>(() => {
    if (typeof window === 'undefined') return 'frames';
    const saved = window.localStorage.getItem(GALLERY_STORAGE_KEYS.viewType);
    return saved === 'merged' ? 'merged' : 'frames';
  });
  const [batchSize, setBatchSize] = useState<number>(DEFAULT_MERGE_BATCH_SIZE);
  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>('all');
  const [showMergeGroupDialog, setShowMergeGroupDialog] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [deduplicateProgress, setDeduplicateProgress] = useState({ current: 0, total: 0 });
  const [sortTrigger, setSortTrigger] = useState(0);
  const [selectedInfoItem, setSelectedInfoItem] = useState<ExtractedFrame | MergedImage | null>(null);

  const getStoredItemsPerPage = (type: ViewType): number => {
    if (typeof window === 'undefined') return 50;
    const key = type === 'frames'
      ? GALLERY_STORAGE_KEYS.itemsPerPageFrames
      : GALLERY_STORAGE_KEYS.itemsPerPageMerged;
    const value = Number(window.localStorage.getItem(key));
    return [20, 50, 100, 200].includes(value) ? value : 50;
  };

  const getStoredItemsPerRow = (type: ViewType): ItemsPerRow => {
    if (typeof window === 'undefined') return 5;
    const key = type === 'frames'
      ? GALLERY_STORAGE_KEYS.itemsPerRowFrames
      : GALLERY_STORAGE_KEYS.itemsPerRowMerged;
    const value = Number(window.localStorage.getItem(key));
    return value === 1 || value === 3 || value === 5 ? value : 5;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => getStoredItemsPerPage(viewType));
  const [itemsPerRow, setItemsPerRow] = useState<ItemsPerRow>(() => getStoredItemsPerRow(viewType));

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const notifier = useNotifier();

  // ── 排序与过滤（共用 hook）──────────────────────────────────────────────────

  const filteredFrames = useFrameFilter({ frames, selectedGroup, sortTrigger });

  // ── 分页 ────────────────────────────────────────────────────────────────────

  const currentItems = React.useMemo(() => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [viewType, filteredFrames, mergedImages, currentPage, itemsPerPage]);

  const totalPages = React.useMemo(() => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    return Math.ceil(items.length / itemsPerPage);
  }, [viewType, filteredFrames, mergedImages, itemsPerPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [viewType, selectedGroup]);

  React.useEffect(() => {
    setItemsPerPage(getStoredItemsPerPage(viewType));
    setItemsPerRow(getStoredItemsPerRow(viewType));
  }, [viewType]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GALLERY_STORAGE_KEYS.viewType, viewType);
  }, [viewType]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = viewType === 'frames'
      ? GALLERY_STORAGE_KEYS.itemsPerPageFrames
      : GALLERY_STORAGE_KEYS.itemsPerPageMerged;
    window.localStorage.setItem(key, String(itemsPerPage));
  }, [itemsPerPage, viewType]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = viewType === 'frames'
      ? GALLERY_STORAGE_KEYS.itemsPerRowFrames
      : GALLERY_STORAGE_KEYS.itemsPerRowMerged;
    window.localStorage.setItem(key, String(itemsPerRow));
  }, [itemsPerRow, viewType]);

  const gridColsClass = React.useMemo(() => {
    switch (itemsPerRow) {
      case 1: return 'grid-cols-1';
      case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      default: return 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-5';
    }
  }, [itemsPerRow]);

  // ── 选择逻辑 ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    const nextOrder = [...selectedOrder];
    if (next.has(id)) {
      next.delete(id);
      const idx = nextOrder.indexOf(id);
      if (idx > -1) nextOrder.splice(idx, 1);
    } else {
      next.add(id);
      nextOrder.push(id);
    }
    setSelectedIds(next);
    setSelectedOrder(nextOrder);
  };

  const selectAll = () => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
    const newIds = new Set(selectedIds);
    const newOrder = [...selectedOrder];
    if (allSelected) {
      items.forEach((item) => {
        newIds.delete(item.id);
        const idx = newOrder.indexOf(item.id);
        if (idx > -1) newOrder.splice(idx, 1);
      });
    } else {
      items.forEach((item) => {
        if (!newIds.has(item.id)) {
          newIds.add(item.id);
          newOrder.push(item.id);
        }
      });
    }
    setSelectedIds(newIds);
    setSelectedOrder(newOrder);
  };

  const invertSelection = () => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    const newIds = new Set(selectedIds);
    const newOrder = [...selectedOrder];
    items.forEach(({ id }) => {
      if (newIds.has(id)) {
        newIds.delete(id);
        const idx = newOrder.indexOf(id);
        if (idx > -1) newOrder.splice(idx, 1);
      } else {
        newIds.add(id);
        newOrder.push(id);
      }
    });
    setSelectedIds(newIds);
    setSelectedOrder(newOrder);
  };

  const toggleRangeSelectMode = () => {
    if (!rangeSelectMode) {
      const items = viewType === 'frames' ? filteredFrames : mergedImages;
      const lastId = selectedOrder[selectedOrder.length - 1];
      setRangeStart(lastId && items.some((i) => i.id === lastId) ? lastId : null);
      setRangeSelectMode(true);
    } else {
      setRangeSelectMode(false);
      setRangeStart(null);
    }
  };

  const handleRangeSelect = (id: string) => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    if (!rangeStart) {
      setRangeStart(id);
      return;
    }
    const startIdx = items.findIndex((i) => i.id === rangeStart);
    const endIdx = items.findIndex((i) => i.id === id);
    const min = Math.min(startIdx, endIdx);
    const max = Math.max(startIdx, endIdx);
    const rangeIds = items.slice(min, max + 1).map((i) => i.id);
    const newIds = new Set(selectedIds);
    const newOrder = [...selectedOrder];
    rangeIds.forEach((rid) => {
      if (!newIds.has(rid)) {
        newIds.add(rid);
        newOrder.push(rid);
      }
    });
    setSelectedIds(newIds);
    setSelectedOrder(newOrder);
    setRangeSelectMode(false);
    setRangeStart(null);
  };

  const handleImageClick = (id: string) => {
    if (rangeSelectMode) handleRangeSelect(id);
    else toggleSelect(id);
  };

  // ── 操作处理 ────────────────────────────────────────────────────────────────

  const handleDownloadZip = async () => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    if (items.length === 0) { notifier.addToast('没有可下载的图片', 'warning'); return; }
    setIsDownloading(true);
    try {
      await downloadAsZip(
        items.map((i) => ({ url: i.url, filename: i.filename })),
        viewType === 'frames'
          ? `字幕截取_${Date.now()}.zip`
          : `拼接结果_${Date.now()}.zip`
      );
      notifier.addToast(`成功下载 ${items.length} 张图片`, 'success');
    } catch {
      notifier.addToast('下载失败，请重试', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteSelected = async () => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    const selected = items.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) { notifier.addToast('请先选择要删除的图片', 'warning'); return; }

    const confirmed = await confirmDelete(selected.length, '选中', notifier);
    if (!confirmed) return;

    const ids = selected.map((i) => i.id);
    const idSet = new Set(ids);
    if (viewType === 'frames') onDelete?.(ids);
    else onDeleteMerged?.(ids);

    const newIds = new Set(selectedIds);
    ids.forEach((id) => newIds.delete(id));
    const newOrder = selectedOrder.filter((id) => !idSet.has(id));
    setSelectedIds(newIds);
    setSelectedOrder(newOrder);
    notifier.addToast(`已删除 ${selected.length} 张图片`, 'success');
  };

  const handleDeleteBeforeSelected = async () => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    const selectedInView = items.filter((i) => selectedIds.has(i.id));
    if (selectedInView.length === 0) { notifier.addToast('请先选择图片', 'warning'); return; }

    // 找到选中图片中索引最小的那张（最早的），删除它及之前所有图片
    const firstSelectedIdx = items.findIndex((i) => selectedIds.has(i.id));
    const toDelete = items.slice(0, firstSelectedIdx + 1);
    if (toDelete.length === 0) return;

    const confirmed = await notifier.showConfirm({
      title: '删除之前的图片',
      message: `将删除第 1 张到第 ${firstSelectedIdx + 1} 张（含选中图片），共 ${toDelete.length} 张。是否继续？`,
    });
    if (!confirmed) return;

    const ids = toDelete.map((i) => i.id);
    const idSet = new Set(ids);
    if (viewType === 'frames') onDelete?.(ids);
    else onDeleteMerged?.(ids);

    const newIds = new Set(selectedIds);
    ids.forEach((id) => newIds.delete(id));
    const newOrder = selectedOrder.filter((id) => !idSet.has(id));
    setSelectedIds(newIds);
    setSelectedOrder(newOrder);
    notifier.addToast(`已删除 ${toDelete.length} 张图片`, 'success');
  };

  const handleDeleteAfterSelected = async () => {
    const items = viewType === 'frames' ? filteredFrames : mergedImages;
    const selectedInView = items.filter((i) => selectedIds.has(i.id));
    if (selectedInView.length === 0) { notifier.addToast('请先选择图片', 'warning'); return; }

    // 找到选中图片中索引最大的那张（最晚的），删除它及之后所有图片
    let lastSelectedIdx = -1;
    for (let i = items.length - 1; i >= 0; i--) {
      if (selectedIds.has(items[i].id)) { lastSelectedIdx = i; break; }
    }
    const toDelete = items.slice(lastSelectedIdx);
    if (toDelete.length === 0) return;

    const confirmed = await notifier.showConfirm({
      title: '删除之后的图片',
      message: `将删除第 ${lastSelectedIdx + 1} 张到第 ${items.length} 张（含选中图片），共 ${toDelete.length} 张。是否继续？`,
    });
    if (!confirmed) return;

    const ids = toDelete.map((i) => i.id);
    const idSet = new Set(ids);
    if (viewType === 'frames') onDelete?.(ids);
    else onDeleteMerged?.(ids);

    const newIds = new Set(selectedIds);
    ids.forEach((id) => newIds.delete(id));
    const newOrder = selectedOrder.filter((id) => !idSet.has(id));
    setSelectedIds(newIds);
    setSelectedOrder(newOrder);
    notifier.addToast(`已删除 ${toDelete.length} 张图片`, 'success');
  };

  const handleClearCurrent = async () => {
    const count = viewType === 'frames' ? filteredFrames.length : mergedImages.length;
    if (count === 0) return;
    const confirmed = await confirmDelete(
      count,
      viewType === 'frames' ? '截取' : '拼接',
      notifier
    );
    if (!confirmed) return;
    if (viewType === 'frames') onDelete?.(filteredFrames.map((f) => f.id));
    else onClearMerged?.();
    setSelectedIds(new Set());
    setSelectedOrder([]);
    notifier.addToast(`已清空${viewType === 'frames' ? '截取' : '拼接'}结果`, 'success');
  };

  const handleClearAllData = () => {
    onClearAll?.();
    setSelectedIds(new Set());
    setSelectedOrder([]);
  };

  const handleMergeSelected = () => {
    if (selectedIds.size < 1) { notifier.addToast('请至少选择 1 张图片进行拼接', 'warning'); return; }
    const frameById = new Map(filteredFrames.map((f) => [f.id, f] as const));
    const ordered = selectedOrder
      .map((id) => frameById.get(id))
      .filter(Boolean) as ExtractedFrame[];
    onMerge(ordered, batchSize);
    setSelectedIds(new Set());
    setSelectedOrder([]);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    try {
      const importedFrames: ExtractedFrame[] = [];
      const importedMerged: MergedImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = dataUrl;
        });
        const id = `imported_${Date.now()}_${i}`;
        if (viewType === 'frames') {
          importedFrames.push({
            id, url: dataUrl, timestamp: '00:00:00.000',
            filename: file.name, videoName: 'imported',
            group: selectedGroup === 'all' ? 'group1' : selectedGroup,
          });
        } else {
          importedMerged.push({ id, url: dataUrl, width: img.width, height: img.height, filename: file.name });
        }
      }

      if (viewType === 'frames' && importedFrames.length > 0) {
        onImportFrames?.(importedFrames);
        notifier.addToast(`成功导入 ${importedFrames.length} 张截取图片`, 'success');
      } else if (viewType === 'merged' && importedMerged.length > 0) {
        onImportMerged?.(importedMerged);
        notifier.addToast(`成功导入 ${importedMerged.length} 张拼接图片`, 'success');
      }
    } catch {
      notifier.addToast('导入失败，请重试', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMergeGroupsConfirm = async (
    sourceGroup: 'group1' | 'group2',
    targetGroup: 'group1' | 'group2'
  ) => {
    if (!onMergeGroups) return;
    const sourceLabel = sourceGroup === 'group1' ? '【对话】' : '【地点】';
    const targetLabel = targetGroup === 'group1' ? '【对话】' : '【地点】';
    const sourceCount = frames.filter((f) => f.group === sourceGroup).length;
    if (sourceCount === 0) { notifier.addToast(`${sourceLabel}中没有图片`, 'warning'); return; }

    const confirmed = await notifier.showConfirm({
      title: '确认合并分组',
      message: `确定要将${sourceLabel}的 ${sourceCount} 张图片合并到${targetLabel}吗？文件名保持不变。`,
    });
    if (confirmed) {
      onMergeGroups(sourceGroup, targetGroup);
      setShowMergeGroupDialog(false);
      notifier.addToast(`已将${sourceLabel}合并到${targetLabel}`, 'success');
    }
  };

  const handleRemoveDuplicates = async () => {
    if (filteredFrames.length === 0) { notifier.addToast('没有可去重的图片', 'warning'); return; }
    const count = filteredFrames.length;
    const chunkCount = Math.ceil(count / 50);
    const willUseParallel = count > 50;

    const confirmed = await notifier.showConfirm({
      title: '去除重复图片',
      message: willUseParallel
        ? `将分析 ${count} 张图片的相似度（分${chunkCount}组并行处理），保留后一张，删除前一张。是否继续？`
        : `将分析 ${count} 张图片的相似度，保留后一张，删除前一张。是否继续？`,
    });
    if (!confirmed) return;

    setIsDeduplicating(true);
    setDeduplicateProgress({ current: 0, total: count - 1 });
    try {
      const { removeDuplicateImagesAdvanced } = await import('../utils/imageComparisonUtils');
      const keepIndices = await removeDuplicateImagesAdvanced(
        filteredFrames.map((f) => f.url),
        0.95,
        (current, total) => setDeduplicateProgress({ current, total })
      );
      const keepSet = new Set(keepIndices);
      const deleteIds = filteredFrames
        .filter((_, i) => !keepSet.has(i))
        .map((f) => f.id);

      if (deleteIds.length === 0) {
        notifier.addToast('未发现重复图片', 'info');
      } else {
        onDelete?.(deleteIds);
        notifier.addToast(
          `已删除 ${deleteIds.length} 张重复图片，保留 ${keepIndices.length} 张${willUseParallel ? ` (${chunkCount}组并行处理)` : ''}`,
          'success'
        );
      }
    } catch {
      notifier.addToast('去重失败，请重试', 'error');
    } finally {
      setIsDeduplicating(false);
      setDeduplicateProgress({ current: 0, total: 0 });
    }
  };

  // ── 渲染 ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 px-3 pb-2 pt-0 sm:px-4 sm:pt-0 lg:px-5">
      {/* 固定头部容器 - 包含两个工具栏 */}
      <div className="sticky top-[52px] z-40 space-y-1 rounded-none border border-gray-200/80 bg-white px-4 py-2 shadow-sm sm:px-5">
        <GalleryToolbar
          frames={frames}
          mergedImages={mergedImages}
          filteredFrames={filteredFrames}
          viewType={viewType}
          selectedGroup={selectedGroup}
          selectedIds={selectedIds}
          rangeSelectMode={rangeSelectMode}
          isDeduplicating={isDeduplicating}
          deduplicateProgress={deduplicateProgress}
          isDownloading={isDownloading}
          batchSize={batchSize}
          itemsPerPage={itemsPerPage}
          itemsPerRow={itemsPerRow}
          fileInputRef={fileInputRef}
          onViewTypeChange={(type) => {
            setViewType(type);
            setSelectedIds(new Set());
            setSelectedOrder([]);
          }}
          onGroupChange={setSelectedGroup}
          onToggleRangeSelectMode={toggleRangeSelectMode}
          onMergeSelected={handleMergeSelected}
          onBatchSizeChange={setBatchSize}
          onItemsPerPageChange={(count) => {
            setItemsPerPage(count);
            setCurrentPage(1);
          }}
          onItemsPerRowChange={setItemsPerRow}
          onClearCurrent={handleClearCurrent}
          onRemoveDuplicates={handleRemoveDuplicates}
          onImportClick={handleImportClick}
          onFileImport={handleFileImport}
          onDownloadZip={handleDownloadZip}
          onClearAllData={handleClearAllData}
          onMergeGroupsClick={() => setShowMergeGroupDialog(true)}
        />

        <PaginationToolbar
          frames={frames}
          mergedImages={mergedImages}
          filteredFrames={filteredFrames}
          viewType={viewType}
          selectedIds={selectedIds}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          itemsPerRow={itemsPerRow}
          onSelectAll={selectAll}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onItemsPerRowChange={setItemsPerRow}
          onClearCurrent={handleClearCurrent}
        />
      </div>

      <div className={`grid ${gridColsClass} gap-5`}>
        {viewType === 'frames'
          ? (currentItems as ExtractedFrame[]).map((frame) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                isSelected={selectedIds.has(frame.id)}
                isRangeStart={rangeSelectMode && rangeStart === frame.id}
                selectionOrder={selectedOrder.indexOf(frame.id) + 1}
                onClick={handleImageClick}
                onJumpToTime={onJumpToTime}
                onShowInfo={setSelectedInfoItem}
              />
            ))
          : (currentItems as MergedImage[]).map((img) => (
              <MergedImageCard
                key={img.id}
                img={img}
                isSelected={selectedIds.has(img.id)}
                isRangeStart={rangeSelectMode && rangeStart === img.id}
                selectionOrder={selectedOrder.indexOf(img.id) + 1}
                onClick={handleImageClick}
                onShowInfo={setSelectedInfoItem}
              />
            ))}
      </div>

      {viewType === 'frames' && filteredFrames.length === 0 && (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {selectedGroup === 'all'
              ? '暂无截取结果。'
              : `分组${selectedGroup.replace('group', '')}暂无截取结果。`}
          </p>
        </div>
      )}

      {viewType === 'merged' && mergedImages.length === 0 && (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">暂无拼接图片。</p>
          <p className="text-sm text-gray-400 mt-2">请先提取字幕，然后选中图片进行拼接。</p>
        </div>
      )}

      {showMergeGroupDialog && (
        <MergeGroupDialog
          frames={frames}
          onConfirm={handleMergeGroupsConfirm}
          onCancel={() => setShowMergeGroupDialog(false)}
        />
      )}

      {/* 图片信息侧边栏 */}
      {selectedInfoItem && (
        <ImageInfoPanel
          item={selectedInfoItem}
          viewType={viewType}
          onClose={() => setSelectedInfoItem(null)}
        />
      )}

      {/* 底部悬浮工具栏：有选中时显示 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl shadow-2xl border border-gray-200 ring-1 ring-black/5 whitespace-nowrap">
          {/* 计数 */}
          <span className="text-xs font-semibold text-indigo-600 px-1.5">
            已选 {(viewType === 'frames' ? filteredFrames : mergedImages).filter((i) => selectedIds.has(i.id)).length}
          </span>

          <div className="h-5 w-px bg-gray-200 mx-0.5" />

          {/* 选择操作组 */}
          <button
            onClick={() => { setSelectedIds(new Set()); setSelectedOrder([]); }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-3 h-3" /> 取消
          </button>
          <button
            onClick={invertSelection}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> 反选
          </button>
          <button
            onClick={toggleRangeSelectMode}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              rangeSelectMode
                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            <Scissors className="w-3 h-3" /> 范围
          </button>

          <div className="h-5 w-px bg-gray-200 mx-0.5" />

          {/* 删除操作组 */}
          <button
            onClick={handleDeleteBeforeSelected}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 active:scale-95 transition-all"
            title="删除选中图片及之前所有图片"
          >
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
            <span>删除之前</span>
          </button>
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 active:scale-95 transition-all"
            title="删除选中图片"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>删除选中</span>
          </button>
          <button
            onClick={handleDeleteAfterSelected}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 active:scale-95 transition-all"
            title="删除选中图片及之后所有图片"
          >
            <span>删除之后</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ResultGallery;
