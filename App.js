import { StatusBar } from 'expo-status-bar';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 120;

const getYearValue = (asset) => new Date(asset.creationTime * 1000).getFullYear();

const getMonthKey = (asset) => {
  const date = new Date(asset.creationTime * 1000);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const formatMonthLabel = (key) => {
  if (!key) return '';
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
};

const formatFullDate = (asset) => {
  const date = new Date(asset.creationTime * 1000);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const filterAssets = (
  assets,
  hiddenSet,
  filterMode,
  selectedMonthKey,
  selectedYear,
  recentDays
) => {
  const now = Date.now();
  const recentCutoff = now - recentDays * 24 * 60 * 60 * 1000;

  return assets.filter((asset) => {
    if (hiddenSet.has(asset.id)) {
      return false;
    }
    if (filterMode === 'month') {
      return selectedMonthKey ? getMonthKey(asset) === selectedMonthKey : false;
    }
    if (filterMode === 'year') {
      return selectedYear ? getYearValue(asset) === selectedYear : false;
    }
    if (filterMode === 'recent') {
      return asset.creationTime * 1000 >= recentCutoff;
    }
    if (filterMode === 'favorites') {
      return asset.isFavorite === true || asset.favorite === true;
    }
    return true;
  });
};

export default function App() {
  const [permission, setPermission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allAssets, setAllAssets] = useState([]);
  const [pickedAssets, setPickedAssets] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [deleteQueue, setDeleteQueue] = useState(() => new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterMode, setFilterMode] = useState('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [recentDays, setRecentDays] = useState(30);
  const [showRecentPicker, setShowRecentPicker] = useState(false);
  const [currentAssetId, setCurrentAssetId] = useState(null);
  const [currentAssetUri, setCurrentAssetUri] = useState(null);

  const position = useRef(new Animated.ValueXY()).current;
  const currentAssetRef = useRef(null);

  useEffect(() => {
    currentAssetRef.current = currentAsset;
  }, [currentAsset]);

  const requestPermissionAndLoad = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await MediaLibrary.requestPermissionsAsync();
      setPermission(result);
      console.log('Permission result:', result);
      
      if (result.status !== 'granted') {
        setLoading(false);
        setLoadError(`Permission denied. Status: ${result.status}`);
        return;
      }

      const collected = [];
      let after = undefined;
      let hasNext = true;
      let pageCount = 0;

      while (hasNext && pageCount < 50) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: 200,
          after,
          sortBy: MediaLibrary.SortBy.creationTime,
        });
        console.log(`Loaded page ${pageCount + 1}: ${page.assets.length} assets`);
        collected.push(...page.assets.map((asset) => ({ ...asset, canDelete: true })));
        after = page.endCursor;
        hasNext = page.hasNextPage;
        pageCount++;
      }

      if (collected.length === 0) {
        console.log('No assets found, trying fallback...');
        const fallback = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: 200,
        });
        console.log(`Fallback loaded: ${fallback.assets.length} assets`);
        collected.push(...fallback.assets.map((asset) => ({ ...asset, canDelete: true })));
      }

      collected.reverse();
      console.log(`Total assets loaded: ${collected.length}`);
      setAllAssets(collected);
    } catch (error) {
      console.error('Error loading photos:', error);
      setLoadError(`Failed to load photos: ${error.message || 'Unknown error'}`);
      setAllAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void requestPermissionAndLoad();
  }, [requestPermissionAndLoad]);

  const combinedAssets = useMemo(() => {
    const merged = [...allAssets, ...pickedAssets];
    merged.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));
    return merged;
  }, [allAssets, pickedAssets]);

  const monthOptions = useMemo(() => {
    const keys = new Set();
    for (const asset of combinedAssets) {
      keys.add(getMonthKey(asset));
    }
    return Array.from(keys)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((key) => ({ key, label: formatMonthLabel(key) }));
  }, [combinedAssets]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    for (const asset of combinedAssets) {
      years.add(getYearValue(asset));
    }
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((year) => ({ key: String(year), label: String(year), value: year }));
  }, [combinedAssets]);

  useEffect(() => {
    if (!selectedMonthKey && monthOptions.length > 0) {
      setSelectedMonthKey(monthOptions[0].key);
    }
  }, [monthOptions, selectedMonthKey]);

  useEffect(() => {
    if (!selectedYear && yearOptions.length > 0) {
      setSelectedYear(yearOptions[0].value);
    }
  }, [selectedYear, yearOptions]);

  const filteredAssets = useMemo(() => {
    return filterAssets(
      combinedAssets,
      hiddenIds,
      filterMode,
      selectedMonthKey,
      selectedYear,
      recentDays
    );
  }, [combinedAssets, filterMode, hiddenIds, recentDays, selectedMonthKey, selectedYear]);

  const currentAsset = useMemo(
    () => filteredAssets.find((asset) => asset.id === currentAssetId) || null,
    [currentAssetId, filteredAssets]
  );

  useEffect(() => {
    let isActive = true;
    const loadAssetUri = async () => {
      if (!currentAsset) {
        setCurrentAssetUri(null);
        return;
      }
      if (currentAsset.canDelete === false || currentAsset.isPicked) {
        setCurrentAssetUri(currentAsset.uri);
        return;
      }
      try {
        const info = await MediaLibrary.getAssetInfoAsync(currentAsset.id, {
          shouldDownloadFromNetwork: true,
        });
        const uri = info.localUri || info.uri;
        if (isActive) {
          setCurrentAssetUri(uri);
        }
      } catch (error) {
        if (isActive) {
          setCurrentAssetUri(currentAsset.uri);
        }
      }
    };

    void loadAssetUri();
    return () => {
      isActive = false;
    };
  }, [currentAsset]);

  const pickRandomAsset = useCallback(
    (list) => {
      if (!list.length) {
        setCurrentAssetId(null);
        return;
      }
      const next = list[Math.floor(Math.random() * list.length)];
      setCurrentAssetId(next.id);
    },
    [setCurrentAssetId]
  );

  useEffect(() => {
    if (!filteredAssets.length) {
      setCurrentAssetId(null);
      return;
    }
    if (!currentAssetId || !filteredAssets.some((asset) => asset.id === currentAssetId)) {
      pickRandomAsset(filteredAssets);
    }
  }, [currentAssetId, filteredAssets, pickRandomAsset]);

  const markHidden = useCallback((assetId) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
  }, []);

  const pickNextAfterHide = useCallback(
    (assetId, assetsOverride = null) => {
      const hiddenNext = new Set(hiddenIds);
      hiddenNext.add(assetId);
      const baseAssets = assetsOverride || combinedAssets;
      const nextList = filterAssets(
        baseAssets,
        hiddenNext,
        filterMode,
        selectedMonthKey,
        selectedYear,
        recentDays
      );
      pickRandomAsset(nextList);
    },
    [combinedAssets, filterMode, hiddenIds, pickRandomAsset, recentDays, selectedMonthKey, selectedYear]
  );

  const handleKeep = useCallback(
    (asset) => {
      if (!asset) return;
      markHidden(asset.id);
      pickNextAfterHide(asset.id);
    },
    [markHidden, pickNextAfterHide]
  );

  const handleDelete = useCallback(
    (asset) => {
      if (!asset) return;
      if (asset.canDelete === false || asset.isPicked) {
        markHidden(asset.id);
        setPickedAssets((prev) => prev.filter((item) => item.id !== asset.id));
        pickNextAfterHide(asset.id);
        return;
      }
      setDeleteQueue((prev) => new Set([...prev, asset.id]));
      markHidden(asset.id);
      pickNextAfterHide(asset.id);
    },
    [markHidden, pickNextAfterHide]
  );

  const executeDeletions = useCallback(async () => {
    if (deleteQueue.size === 0) return;

    const ensureDeletePermission = async () => {
      const current = await MediaLibrary.getPermissionsAsync();
      if (current.status !== 'granted') {
        const next = await MediaLibrary.requestPermissionsAsync({ accessPrivileges: 'all' });
        if (next.status !== 'granted') {
          return false;
        }
        return next.accessPrivileges === 'all' || next.accessPrivileges === undefined;
      }
      if (current.accessPrivileges && current.accessPrivileges !== 'all') {
        try {
          await MediaLibrary.presentPermissionsPickerAsync();
        } catch (error) {
          // Ignore and fall back to Settings prompt if needed.
        }
        const updated = await MediaLibrary.getPermissionsAsync();
        return updated.accessPrivileges === 'all';
      }
      return true;
    };

    setIsDeleting(true);
    try {
      const canDelete = await ensureDeletePermission();
      if (!canDelete) {
        Alert.alert(
          'Full access required',
          'To delete photos, allow full access to your photo library in Settings.',
          [{ text: 'OK', onPress: () => Linking.openSettings() }]
        );
        setIsDeleting(false);
        return;
      }

      const idsToDelete = Array.from(deleteQueue);
      await MediaLibrary.deleteAssetsAsync(idsToDelete);
      
      setAllAssets((prev) => prev.filter((item) => !deleteQueue.has(item.id)));
      setDeleteQueue(new Set());
      Alert.alert('Success', `Deleted ${idsToDelete.length} photo${idsToDelete.length > 1 ? 's' : ''}`);
    } catch (error) {
      Alert.alert(
        'Delete failed',
        `Could not delete photos: ${error.message || 'Unknown error'}. Make sure Expo Go has full photo access.`,
        [{ text: 'OK', onPress: () => Linking.openSettings() }]
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteQueue]);

  const handleImportPhotos = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to import images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 1,
    });

    if (result.canceled) {
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const imported = result.assets.map((asset, index) => ({
      id: `picked-${Date.now()}-${index}`,
      uri: asset.uri,
      creationTime: nowSeconds,
      canDelete: false,
      isPicked: true,
    }));

    setPickedAssets((prev) => [...imported, ...prev]);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onPanResponderGrant: () => {
        position.setOffset({
          x: position.x._value,
          y: position.y._value,
        });
      },
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        position.flattenOffset();
        const asset = currentAssetRef.current;
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            position.setValue({ x: 0, y: 0 });
            if (asset) handleKeep(asset);
          });
          return;
        }
        if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            position.setValue({ x: 0, y: 0 });
            if (asset) handleDelete(asset);
          });
          return;
        }
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          tension: 50,
          friction: 7,
        }).start();
      },
    })
  ).current;

  const remainingCount = filteredAssets.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Swipe to keep or delete</Text>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterButton, filterMode === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterMode('all')}
          >
            <Text style={styles.filterButtonText}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, filterMode === 'month' && styles.filterButtonActive]}
            onPress={() => setFilterMode('month')}
          >
            <Text style={styles.filterButtonText}>Month / Year</Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, filterMode === 'year' && styles.filterButtonActive]}
            onPress={() => setFilterMode('year')}
          >
            <Text style={styles.filterButtonText}>Year</Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, filterMode === 'recent' && styles.filterButtonActive]}
            onPress={() => setFilterMode('recent')}
          >
            <Text style={styles.filterButtonText}>Recent</Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, filterMode === 'favorites' && styles.filterButtonActive]}
            onPress={() => setFilterMode('favorites')}
          >
            <Text style={styles.filterButtonText}>Favorites</Text>
          </Pressable>
        </View>
        <Pressable style={styles.monthPickerButton} onPress={handleImportPhotos}>
          <Text style={styles.monthPickerText}>Import Photos</Text>
        </Pressable>
        {filterMode === 'month' && (
          <Pressable
            style={styles.monthPickerButton}
            onPress={() => setShowMonthPicker(true)}
          >
            <Text style={styles.monthPickerText}>
              {formatMonthLabel(selectedMonthKey) || 'Choose month'}
            </Text>
          </Pressable>
        )}
        {filterMode === 'year' && (
          <Pressable style={styles.monthPickerButton} onPress={() => setShowYearPicker(true)}>
            <Text style={styles.monthPickerText}>
              {selectedYear ? String(selectedYear) : 'Choose year'}
            </Text>
          </Pressable>
        )}
        {filterMode === 'recent' && (
          <Pressable style={styles.monthPickerButton} onPress={() => setShowRecentPicker(true)}>
            <Text style={styles.monthPickerText}>Last {recentDays} days</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.cardArea}>
        {loading && <ActivityIndicator size="large" color="#8B8B8B" />}
        {!loading && permission?.status !== 'granted' && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Photo access needed</Text>
            <Text style={styles.emptyText}>
              Allow photo access to swipe through your library.
            </Text>
            <Pressable style={styles.primaryButton} onPress={requestPermissionAndLoad}>
              <Text style={styles.primaryButtonText}>Enable Access</Text>
            </Pressable>
          </View>
        )}
        {!loading &&
          permission?.status === 'granted' &&
          permission?.accessPrivileges === 'limited' && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Limited access</Text>
              <Text style={styles.emptyText}>
                Choose photos to review or grant full access.
              </Text>
              <View style={styles.rowButtons}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => void MediaLibrary.presentPermissionsPickerAsync()}
                >
                  <Text style={styles.primaryButtonText}>Select Photos</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={styles.secondaryButtonText}>Open Settings</Text>
                </Pressable>
              </View>
              <Pressable style={styles.linkButton} onPress={requestPermissionAndLoad}>
                <Text style={styles.linkButtonText}>Refresh</Text>
              </Pressable>
            </View>
          )}
        {!loading && permission?.status === 'granted' && !currentAsset && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No photos found</Text>
            <Text style={styles.emptyText}>
              Try switching filters or add photos to your library.
            </Text>
            {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
            <Pressable style={styles.linkButton} onPress={requestPermissionAndLoad}>
              <Text style={styles.linkButtonText}>Refresh</Text>
            </Pressable>
            <Text style={styles.metaText}>
              Loaded: {combinedAssets.length} • Filtered: {filteredAssets.length}
            </Text>
          </View>
        )}
        {!loading && permission?.status === 'granted' && currentAsset && currentAssetUri && (
          <Animated.View
            style={[styles.card, position.getLayout()]}
            {...panResponder.panHandlers}
          >
            <ExpoImage
              source={{ uri: currentAssetUri }}
              style={styles.image}
              contentFit="cover"
            />
            <View style={styles.cardMeta}>
              <Text style={styles.cardDate}>{formatFullDate(currentAsset)}</Text>
            </View>
          </Animated.View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, styles.actionDelete]}
          onPress={() => void handleDelete(currentAsset)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => pickRandomAsset(filteredAssets)}>
          <Text style={styles.actionButtonText}>Random</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionKeep]}
          onPress={() => handleKeep(currentAsset)}
        >
          <Text style={styles.actionButtonText}>Keep</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.remainingText}>{remainingCount} remaining</Text>
        {deleteQueue.size > 0 && (
          <Pressable
            style={[styles.deleteQueueButton, isDeleting && styles.deleteQueueButtonDisabled]}
            onPress={executeDeletions}
            disabled={isDeleting}
          >
            <Text style={styles.deleteQueueButtonText}>
              {isDeleting ? 'Deleting...' : `Delete ${deleteQueue.size} Photo${deleteQueue.size > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        )}
      </View>

      <Modal visible={showMonthPicker} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pick a month</Text>
            <FlatList
              data={monthOptions}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedMonthKey(item.key);
                    setFilterMode('month');
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{item.label}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No months yet.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setShowMonthPicker(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showYearPicker} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pick a year</Text>
            <FlatList
              data={yearOptions}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedYear(item.value);
                    setFilterMode('year');
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{item.label}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No years yet.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setShowYearPicker(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showRecentPicker} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Recent range</Text>
            {[7, 30, 90, 365].map((days) => (
              <Pressable
                key={days}
                style={styles.modalOption}
                onPress={() => {
                  setRecentDays(days);
                  setFilterMode('recent');
                  setShowRecentPicker(false);
                }}
              >
                <Text style={styles.modalOptionText}>Last {days} days</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalClose} onPress={() => setShowRecentPicker(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101214',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    color: '#F2F2F2',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A2D31',
  },
  filterButtonActive: {
    backgroundColor: '#1E90FF',
    borderColor: '#1E90FF',
  },
  filterButtonText: {
    color: '#F2F2F2',
    fontSize: 13,
    fontWeight: '600',
  },
  monthPickerButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2D31',
    marginBottom: 8,
  },
  monthPickerText: {
    color: '#F2F2F2',
    fontSize: 14,
    fontWeight: '500',
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1A1D21',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardMeta: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 18, 20, 0.7)',
  },
  cardDate: {
    color: '#F2F2F2',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#2A2D31',
  },
  actionDelete: {
    backgroundColor: '#C83B3B',
  },
  actionKeep: {
    backgroundColor: '#21A453',
  },
  actionButtonText: {
    color: '#F2F2F2',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  remainingText: {
    textAlign: 'center',
    color: '#9AA0A6',
    marginBottom: 8,
  },
  deleteQueueButton: {
    backgroundColor: '#C83B3B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteQueueButtonDisabled: {
    opacity: 0.6,
  },
  deleteQueueButtonText: {
    color: '#F2F2F2',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#F2F2F2',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyText: {
    color: '#9AA0A6',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#1E90FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#F2F2F2',
    fontWeight: '600',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2A2D31',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#F2F2F2',
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 8,
  },
  linkButtonText: {
    color: '#1E90FF',
    fontWeight: '600',
  },
  metaText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 12,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16181B',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    color: '#F2F2F2',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 12,
  },
  modalOptionText: {
    color: '#F2F2F2',
    fontSize: 16,
  },
  modalClose: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  modalCloseText: {
    color: '#1E90FF',
    fontSize: 15,
    fontWeight: '600',
  },
});
