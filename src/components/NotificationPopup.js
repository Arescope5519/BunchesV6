import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

/**
 * Notification popup for friend requests
 * Shows at the top of the screen with Accept/Decline actions
 */
const NotificationPopup = ({
  visible,
  request,
  onAccept,
  onDecline,
  onDismiss,
  colors,
}) => {
  const [slideAnim] = React.useState(new Animated.Value(-200));

  React.useEffect(() => {
    if (visible) {
      // Slide down
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();

      // Auto-dismiss after 10 seconds
      const timeout = setTimeout(() => {
        handleDismiss();
      }, 10000);

      return () => clearTimeout(timeout);
    } else {
      // Slide up
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  const handleAccept = () => {
    handleDismiss();
    if (onAccept) onAccept();
  };

  const handleDecline = () => {
    handleDismiss();
    if (onDecline) onDecline();
  };

  if (!request) return null;

  const styles = createStyles(colors);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>👥</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Friend Request</Text>
            <Text style={styles.subtitle}>
              {request.senderUsername} wants to be friends
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={handleDecline}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
          >
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
        >
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      paddingTop: 60, // Below status bar
      paddingHorizontal: 16,
    },
    content: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    icon: {
      fontSize: 32,
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    button: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    declineButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    acceptButton: {
      backgroundColor: colors.primary,
    },
    declineText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    acceptText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    dismissButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dismissText: {
      fontSize: 24,
      color: colors.textSecondary,
      fontWeight: '300',
    },
  });

export default NotificationPopup;
