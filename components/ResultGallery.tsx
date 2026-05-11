import React, { useState } from 'react';
import { Image as ImageIcon, Layers } from 'lucide-react';
import { ExtractedFrame, MergedImage } from '../types';
import { downloadAsZip } from '../utils/imageUtils';
import { useNotifier } from './Notifications';
import { removeDuplicateImagesAdvanced } from '../utils/imageComparisonUtils';
import GalleryToolbar from './resultGallery/GalleryToolbar';
import FrameCard from './resultGallery/FrameCard';
import MergedImageCard from './resultGallery/MergedImageCard';
import MergeGroupDialog from './resultGallery/MergeGroupDialog';
import { ResultGalleryProps, ViewType, GroupFilter, ItemsPerRow } from './resultGallery/types';

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
  const [viewType, setViewType] = useState<ViewType>('frames');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>('all');
  const [showMergeGroupDialog, setShowMergeGroupDialog] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [deduplicateProgress, setDeduplicateProgress] = useState({ current: 0, total: 0 });
  const [sortTrigger, setSortTrigger] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [itemsPerRow, setItemsPerRow] = useState<ItemsPerRow>(5);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const notifier = useNotifier();

  // ── 排序与过滤 ──────────────────────────────────────────────────────────────

  const filteredFrames = React.useMemo(() => {
    const filtered =
      selectedGroup === 'all' ? frames : frames.filter((f) => f.group === selectedGroup);

    const groupPriority: Record<string, number> = { g2: 1, g1: 2 };

    const extractTime = (filename: string): number => {
      const match = filename.match(/\[(\d{2})[_:](\d{2})[_:](\d{2})\.(\d{3})\]/);
      if (!match) return 0;
      const [, h, m, s, ms] = match;
      return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
    };

    const extractGroup = (filename: string): string => {
      const match = filename.match(/^(g[12])_/);
      return match ? match[1] : 'g1';
    };

    return [...filtered].sort((a, b) => {
      const tA = extractTime(a.filename);
      const tB = extractTime(b.filename);
      if (tA !== tB) return tA - tB;
      const pA = groupPriority[extractGroup(a.filename)] ?? 999;
      const pB = groupPriority[extractGroup(b.filename)] ?? 999;
      if (pA !== pB) return pA - pB;
      return a.filename.localeCompare(b.filename);
    });
  }, [frames, selectedGroup, sortTrigger]);

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

    const confirmed = await notifier.showConfirm({
      title: '确认删除',
      message: `确定要删除选中的 ${selected.length} 张图片吗？`,
    });
    if (!confirmed) return;

    const ids = selected.map((i) => i.id);
    if (viewType === 'frames') onDelete?.(ids);
    else onDeleteMerged?.(ids);

    const newIds = new Set(selectedIds);
    const newOrder = [...selectedOrder];
    ids.forEach((id) => {
      newIds.delete(id);
      const idx = newOrder.indexOf(id);
      if (idx > -1) newOrder.splice(idx, 1);
    });
    setSelectedIds(newIds);
    setSelectedOrder(newOrder);
    notifier.addToast(`已删除 ${selected.length} 张图片`, 'success');
  };

  const handleClearCurrent = async () => {
    const count = viewType === 'frames' ? filteredFrames.length : mergedImages.length;
    if (count === 0) return;
    const confirmed = await notifier.showConfirm({
      title: '确认清空',
      message: `确定要清空所有 ${count} 张${viewType === 'frames' ? '截取' : '拼接'}图片吗？`,
    });
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
    const ordered = selectedOrder
      .map((id) => filteredFrames.find((f) => f.id === id))
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
    <div className="space-y-6">
      <GalleryToolbar
        frames={frames}
        mergedImages={mergedImages}
        filteredFrames={filteredFrames}
        viewType={viewType}
        selectedGroup={selectedGroup}
        selectedIds={selectedIds}
        selectedOrder={selectedOrder}
        rangeSelectMode={rangeSelectMode}
        rangeStart={rangeStart}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        itemsPerRow={itemsPerRow}
        isDeduplicating={isDeduplicating}
        deduplicateProgress={deduplicateProgress}
        isDownloading={isDownloading}
        batchSize={batchSize}
        fileInputRef={fileInputRef}
        onViewTypeChange={(type) => {
          setViewType(type);
          setSelectedIds(new Set());
          setSelectedOrder([]);
        }}
        onGroupChange={setSelectedGroup}
        onSelectAll={selectAll}
        onInvertSelection={invertSelection}
        onToggleRangeSelectMode={toggleRangeSelectMode}
        onClearSelection={() => { setSelectedIds(new Set()); setSelectedOrder([]); }}
        onMergeSelected={handleMergeSelected}
        onOneClickRecognize={() => {
          onOneClickRecognize?.();
          setSelectedIds(new Set());
          setSelectedOrder([]);
        }}
        onBatchSizeChange={setBatchSize}
        onRemoveDuplicates={handleRemoveDuplicates}
        onImportClick={handleImportClick}
        onFileImport={handleFileImport}
        onDownloadZip={handleDownloadZip}
        onDeleteSelected={handleDeleteSelected}
        onClearCurrent={handleClearCurrent}
        onClearAllData={handleClearAllData}
        onMergeGroupsClick={() => setShowMergeGroupDialog(true)}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        onItemsPerRowChange={setItemsPerRow}
      />

      <div className={`grid ${gridColsClass} gap-4`}>
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
    </div>
  );
};

export default ResultGallery;
